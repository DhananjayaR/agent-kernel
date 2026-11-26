// NodeJobRecordStore tests, in a temporary folder: one JSON file per job, replaced atomically; ended and
// dismissed records go; a new store on the same folder (a restart) still sees the unfinished ones; corrupt or
// stray files are skipped and logged; a job id can never name a file outside the folder.
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { JobRecord, Log } from "@ak-studio/runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NodeJobRecordStore } from "./NodeJobRecordStore";

let root: string;
let dir: string;
beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "ak-studio-jobs-"));
	dir = join(root, "jobs");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const record = (jobId: string, startedAt = 1000): JobRecord => ({
	jobId,
	kind: "t.demo",
	title: "Demo job",
	startedAt,
	commandIds: [],
});

describe("NodeJobRecordStore", () => {
	it("writes one JSON file per job, creating the folder, and a new store on the folder still sees it", async () => {
		const store = new NodeJobRecordStore(dir);
		await store.started({ ...record("job-a-1"), projectId: "p1" });
		await store.started(record("job-a-2"));
		expect(readdirSync(dir).sort()).toEqual(["job-a-1.json", "job-a-2.json"]);
		expect(JSON.parse(readFileSync(join(dir, "job-a-1.json"), "utf8"))).toEqual(
			{ ...record("job-a-1"), projectId: "p1" },
		);
		const restarted = new NodeJobRecordStore(dir);
		await expect(restarted.unfinished()).resolves.toEqual([
			{ ...record("job-a-1"), projectId: "p1" },
			record("job-a-2"),
		]);
	});

	it("replaces a record in place, leaving no temporary file", async () => {
		const store = new NodeJobRecordStore(dir);
		await store.started(record("job-a-1"));
		await store.started({ ...record("job-a-1"), commandIds: ["cmd-1"] });
		expect(readdirSync(dir)).toEqual(["job-a-1.json"]);
		await expect(store.unfinished()).resolves.toEqual([
			{ ...record("job-a-1"), commandIds: ["cmd-1"] },
		]);
	});

	it("removes its temporary file when a write fails, and rejects", async () => {
		const store = new NodeJobRecordStore(dir);
		// A folder where the record should be: the rename over it fails.
		mkdirSync(join(dir, "job-a-1.json"), { recursive: true });
		await expect(store.started(record("job-a-1"))).rejects.toThrow();
		expect(readdirSync(dir)).toEqual(["job-a-1.json"]);
	});

	it("lists unfinished records oldest first; an ended record is gone", async () => {
		const store = new NodeJobRecordStore(dir);
		await store.started(record("job-a-1", 3000));
		await store.started(record("job-a-2", 1000));
		await store.started(record("job-a-3", 2000));
		await store.ended("job-a-3", "succeeded");
		await expect(store.unfinished()).resolves.toEqual([
			record("job-a-2", 1000),
			record("job-a-1", 3000),
		]);
		expect(existsSync(join(dir, "job-a-3.json"))).toBe(false);
		await expect(store.ended("job-a-3", "succeeded")).resolves.toBeUndefined();
	});

	it("dismisses a record, answering whether there was one", async () => {
		const store = new NodeJobRecordStore(dir);
		await store.started(record("job-a-1"));
		await expect(store.dismiss("job-a-1")).resolves.toBe(true);
		await expect(store.dismiss("job-a-1")).resolves.toBe(false);
		await expect(store.unfinished()).resolves.toEqual([]);
	});

	it("answers no records when the folder does not exist yet", async () => {
		await expect(new NodeJobRecordStore(dir).unfinished()).resolves.toEqual([]);
	});

	it("skips and logs corrupt files, and ignores temporary and other files, without failing", async () => {
		const log = vi.fn<Log>();
		const store = new NodeJobRecordStore(dir, { log });
		await store.started(record("job-a-1"));
		writeFileSync(join(dir, "job-bad-1.json"), "{ not json");
		writeFileSync(
			join(dir, "job-bad-2.json"),
			JSON.stringify({ jobId: "job-bad-2", kind: "" }),
		);
		// A file whose record names another job.
		writeFileSync(
			join(dir, "job-bad-3.json"),
			JSON.stringify(record("job-a-9")),
		);
		// A crash between writing and renaming leaves a temporary file.
		writeFileSync(
			join(dir, ".job-a-4.0123.tmp"),
			JSON.stringify(record("job-a-4")),
		);
		writeFileSync(join(dir, "notes.txt"), "not a record");
		mkdirSync(join(dir, "folder.json"));
		await expect(store.unfinished()).resolves.toEqual([record("job-a-1")]);
		expect(log).toHaveBeenCalledTimes(4);
		for (const name of ["job-bad-1", "job-bad-2", "job-bad-3", "folder.json"]) {
			expect(log).toHaveBeenCalledWith(expect.stringContaining(name));
		}
	});

	it("never touches a file outside its folder, whatever the job id", async () => {
		const outside = join(root, "preferences.json");
		writeFileSync(outside, "{}");
		const store = new NodeJobRecordStore(dir);
		for (const jobId of [
			"../preferences",
			"..",
			"a/b",
			"a\\b",
			".hidden",
			"",
		]) {
			await expect(store.dismiss(jobId), jobId).resolves.toBe(false);
			await expect(
				store.ended(jobId, "failed"),
				jobId,
			).resolves.toBeUndefined();
			await expect(store.started(record(jobId)), jobId).rejects.toThrow(
				/job id/,
			);
		}
		expect(existsSync(outside)).toBe(true);
		expect(existsSync(dir) ? readdirSync(dir) : []).toEqual([]);
	});
});
