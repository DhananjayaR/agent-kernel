// Tests of the port fakes, which later tasks and the browser's mock transport build on: FakeProjectFs keeps
// every path inside the project and refuses a stale write; the others record and replay what they are given.
import { ERROR_CODES, Revision, StudioFailure } from "@ak-studio/contract";
import { describe, expect, it, vi } from "vitest";
import {
	FakeCommandRunner,
	FakeProjectFs,
	FakeWatcher,
	fakeRevision,
	InMemoryJobRecordStore,
} from "./fakes";
import { FileChangedOnDiskFailure } from "./projectFs";

async function failure(promise: Promise<unknown>): Promise<StudioFailure> {
	try {
		await promise;
	} catch (err) {
		if (err instanceof StudioFailure) return err;
		throw err;
	}
	throw new Error("expected a StudioFailure");
}

describe("fakeRevision", () => {
	it("is a content hash in the contract's Revision format", () => {
		const a = fakeRevision("hello");
		expect(Revision.safeParse(a).success).toBe(true);
		expect(fakeRevision("hello")).toBe(a);
		expect(fakeRevision("hello!")).not.toBe(a);
		expect(Revision.safeParse(fakeRevision("")).success).toBe(true);
	});
});

describe("FakeProjectFs", () => {
	const root = "/work/p1";
	const fs = () => new FakeProjectFs(root, { "notes/a.md": "# A\n" });

	it("refuses a relative root (a bug in the caller)", () => {
		for (const bad of ["work/p1", "./p1", ""]) {
			expect(() => new FakeProjectFs(bad), bad).toThrow(/absolute/);
		}
		expect(() => new FakeProjectFs("C:\\work\\p1")).not.toThrow();
	});

	it("reads a file by a relative path or an absolute path inside the root, with its revision", async () => {
		const files = fs();
		const read = await files.read("notes/a.md");
		expect(read).toEqual({ content: "# A\n", revision: fakeRevision("# A\n") });
		await expect(files.read(`${root}/notes/a.md`)).resolves.toEqual(read);
		await expect(files.read("./notes/../notes/a.md")).resolves.toEqual(read);
	});

	it("refuses ../ paths and absolute paths outside the root with file.outsideProject", async () => {
		const files = fs();
		for (const path of [
			"../x",
			"notes/../../x",
			"/etc/passwd",
			"/work/p1-other/a.md",
			"/work",
		]) {
			const err = await failure(files.read(path));
			expect(err.error.code, path).toBe(ERROR_CODES.fileOutsideProject);
			const writeErr = await failure(files.write(path, "x", null));
			expect(writeErr.error.code, path).toBe(ERROR_CODES.fileOutsideProject);
		}
		expect(files.snapshot()).toEqual({ "notes/a.md": "# A\n" });
	});

	it("answers file.notFound for a missing file", async () => {
		const err = await failure(fs().read("missing.md"));
		expect(err.error).toMatchObject({
			code: ERROR_CODES.fileNotFound,
			file: "missing.md",
		});
	});

	it("writes when the base revision is current, and answers the new revision", async () => {
		const files = fs();
		const { revision } = await files.read("notes/a.md");
		await expect(files.write("notes/a.md", "# B\n", revision)).resolves.toEqual(
			{
				revision: fakeRevision("# B\n"),
			},
		);
		await expect(files.read("notes/a.md")).resolves.toMatchObject({
			content: "# B\n",
		});
	});

	it("refuses a stale base revision with file.changedOnDisk, carrying the new content", async () => {
		const files = fs();
		const { revision } = await files.read("notes/a.md");
		files.setFile("notes/a.md", "# Changed elsewhere\n");
		const err = await failure(files.write("notes/a.md", "# Mine\n", revision));
		expect(err).toBeInstanceOf(FileChangedOnDiskFailure);
		expect(err.error).toMatchObject({
			code: ERROR_CODES.fileChangedOnDisk,
			file: "notes/a.md",
		});
		expect((err as FileChangedOnDiskFailure).current).toEqual({
			content: "# Changed elsewhere\n",
			revision: fakeRevision("# Changed elsewhere\n"),
		});
		expect(files.snapshot()["notes/a.md"]).toBe("# Changed elsewhere\n");
	});

	it("creates a file only with a null base, and refuses a null base over an existing file", async () => {
		const files = fs();
		await expect(files.write("new.md", "n", null)).resolves.toEqual({
			revision: fakeRevision("n"),
		});
		const err = await failure(files.write("notes/a.md", "x", null));
		expect(err.error.code).toBe(ERROR_CODES.fileChangedOnDisk);
		const gone = await failure(
			files.write("missing.md", "x", fakeRevision("old")),
		);
		expect(gone.error.code).toBe(ERROR_CODES.fileNotFound);
	});
});

describe("FakeCommandRunner", () => {
	it("records each run, replays its scripted output and answers the exit code", async () => {
		const runner = new FakeCommandRunner(() => ({
			output: [
				["stdout", "hello\n"],
				["stderr", "warn\n"],
			],
			exitCode: 3,
			durationMs: 12,
		}));
		const output: string[] = [];
		const result = await runner.run({
			executable: "oak",
			args: ["--version"],
			cwd: "/work/p1",
			signal: new AbortController().signal,
			onOutput: (channel, text) => output.push(`${channel}:${text}`),
		});
		expect(result).toEqual({ commandId: "cmd-1", exitCode: 3, durationMs: 12 });
		expect(output).toEqual(["stdout:hello\n", "stderr:warn\n"]);
		expect(runner.calls).toEqual([
			expect.objectContaining({ executable: "oak", args: ["--version"] }),
		]);
	});

	it("exits 0 with no output by default, and with a null exit code when aborted", async () => {
		const runner = new FakeCommandRunner();
		const signal = new AbortController().signal;
		await expect(
			runner.run({ executable: "x", args: [], cwd: "/", signal }),
		).resolves.toMatchObject({ commandId: "cmd-1", exitCode: 0 });
		const aborted = new AbortController();
		aborted.abort();
		const onOutput = vi.fn();
		await expect(
			runner.run({
				executable: "x",
				args: [],
				cwd: "/",
				signal: aborted.signal,
				onOutput,
			}),
		).resolves.toMatchObject({ commandId: "cmd-2", exitCode: null });
		expect(onOutput).not.toHaveBeenCalled();
	});
});

describe("FakeWatcher", () => {
	it("reports changes under a watched root until stopped", () => {
		const watcher = new FakeWatcher();
		const onChange = vi.fn();
		const stop = watcher.watch("/work/p1", onChange);
		watcher.change("/work/p1", ["a.md"]);
		watcher.change("/work/p2", ["b.md"]);
		stop();
		watcher.change("/work/p1", ["c.md"]);
		expect(onChange.mock.calls).toEqual([[["a.md"]]]);
		expect(watcher.watching("/work/p1")).toBe(false);
	});
});

describe("InMemoryJobRecordStore", () => {
	const record = {
		jobId: "j1",
		kind: "about.demoJob",
		title: "Demo job",
		startedAt: 1,
		commandIds: [],
	};

	it("lists a started job as unfinished until it ends", async () => {
		const store = new InMemoryJobRecordStore();
		await store.started(record);
		await store.started({ ...record, jobId: "j2" });
		await store.started({ ...record, commandIds: ["c1"] }); // replaces j1's record
		expect(await store.unfinished()).toEqual([
			{ ...record, commandIds: ["c1"] },
			{ ...record, jobId: "j2" },
		]);
		await store.ended("j1", "succeeded");
		expect((await store.unfinished()).map((r) => r.jobId)).toEqual(["j2"]);
	});

	it("dismisses a record, answering whether there was one", async () => {
		const store = new InMemoryJobRecordStore();
		await store.started(record);
		await expect(store.dismiss("j1")).resolves.toBe(true);
		await expect(store.dismiss("j1")).resolves.toBe(false);
		expect(await store.unfinished()).toEqual([]);
	});

	it("keeps unfinished records for a second store on the same data (a restart)", async () => {
		const first = new InMemoryJobRecordStore();
		await first.started(record);
		const second = new InMemoryJobRecordStore(first.data);
		expect(await second.unfinished()).toEqual([record]);
	});
});
