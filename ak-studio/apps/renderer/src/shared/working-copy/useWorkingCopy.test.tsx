// The working-copy rule (architecture.md, rule 3, and "Writing files safely"): a draft records the revision it
// was taken from, is written with that base, is dropped once the write is confirmed and re-read, and is kept and
// flagged as conflicting when the file changes underneath it.
import { ERROR_CODES, type Revision } from "@ak-studio/contract";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StudioFailure } from "../bridge/client";
import { useWorkingCopy, type WorkingCopyOptions } from "./useWorkingCopy";

const rev = (c: string): Revision => c.repeat(64);
const R1 = rev("1");
const R2 = rev("2");
const R3 = rev("3");

interface Deferred<T> {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (err: unknown) => void;
}
function deferred<T>(): Deferred<T> {
	let resolve!: (value: T) => void;
	let reject!: (err: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

const changedOnDisk = () =>
	new StudioFailure({
		code: ERROR_CODES.fileChangedOnDisk,
		message: "The file changed on disk.",
		file: "config.yaml",
	});

/** The hook over a server value the test changes with `rerender`, as a re-read query would. */
function setup(write: WorkingCopyOptions<string>["write"], reread = vi.fn()) {
	const hook = renderHook(
		(props: { value: string; revision: Revision }) =>
			useWorkingCopy({ ...props, write, reread }),
		{ initialProps: { value: "theirs v1", revision: R1 } },
	);
	return { ...hook, reread };
}

describe("useWorkingCopy", () => {
	it("shows the server's value until edited, then the draft, and is dirty while there is one", () => {
		const { result, rerender } = setup(vi.fn());
		expect(result.current.draft).toBe("theirs v1");
		expect(result.current.dirty).toBe(false);
		act(() => result.current.setDraft("mine"));
		expect(result.current.draft).toBe("mine");
		expect(result.current.dirty).toBe(true);
		act(() => result.current.setDraft((current) => `${current}!`));
		expect(result.current.draft).toBe("mine!");
		act(() => result.current.discard());
		expect(result.current.dirty).toBe(false);
		expect(result.current.draft).toBe("theirs v1");
		// Without a draft, a new value from the server simply shows.
		rerender({ value: "theirs v2", revision: R2 });
		expect(result.current.draft).toBe("theirs v2");
		expect(result.current.conflict).toBe(false);
	});

	it("flags a conflict when a new revision arrives while dirty, and keeps the draft", () => {
		const { result, rerender } = setup(vi.fn());
		act(() => result.current.setDraft("mine"));
		rerender({ value: "theirs v2", revision: R2 });
		expect(result.current.conflict).toBe(true);
		expect(result.current.draft).toBe("mine");
		expect(result.current.dirty).toBe(true);
	});

	it("saves with the revision the draft was taken from, and drops the draft once the write is re-read", async () => {
		const write = vi.fn(async () => ({ revision: R2 }));
		const { result, rerender } = setup(write);
		act(() => result.current.setDraft("mine"));
		await act(() => result.current.save());
		expect(write).toHaveBeenCalledExactlyOnceWith("mine", R1);
		// Confirmed, so nothing is unsaved; the draft still shows until the re-read brings it back.
		expect(result.current.dirty).toBe(false);
		expect(result.current.draft).toBe("mine");
		rerender({ value: "mine", revision: R2 });
		expect(result.current.conflict).toBe(false);
		expect(result.current.dirty).toBe(false);
		expect(result.current.draft).toBe("mine");
		rerender({ value: "theirs v3", revision: R3 });
		expect(result.current.draft).toBe("theirs v3");
	});

	it("is not a conflict when its own write is re-read while the save is still answering", async () => {
		const answer = deferred<{ revision: Revision }>();
		const write = vi.fn(() => answer.promise);
		const { result, rerender } = setup(write);
		act(() => result.current.setDraft("mine"));
		let saved: Promise<unknown> = Promise.resolve();
		act(() => {
			saved = result.current.save();
		});
		expect(result.current.saving).toBe(true);
		// The domain event's re-read lands before the command's answer.
		rerender({ value: "mine", revision: R2 });
		expect(result.current.conflict).toBe(false);
		await act(async () => {
			answer.resolve({ revision: R2 });
			await saved;
		});
		expect(result.current.saving).toBe(false);
		expect(result.current.conflict).toBe(false);
		expect(result.current.dirty).toBe(false);
		expect(result.current.draft).toBe("mine");
	});

	it("keeps edits made while saving as a new draft on the written revision", async () => {
		const answer = deferred<{ revision: Revision }>();
		const write = vi.fn(() => answer.promise);
		const { result, rerender } = setup(write);
		act(() => result.current.setDraft("mine"));
		let saved: Promise<unknown> = Promise.resolve();
		act(() => {
			saved = result.current.save();
		});
		act(() => result.current.setDraft("mine, more"));
		await act(async () => {
			answer.resolve({ revision: R2 });
			await saved;
		});
		expect(result.current.dirty).toBe(true);
		rerender({ value: "mine", revision: R2 });
		expect(result.current.conflict).toBe(false);
		expect(result.current.draft).toBe("mine, more");
		await act(() => result.current.save());
		expect(write).toHaveBeenLastCalledWith("mine, more", R2);
	});

	it("flags a conflict on a stale save, keeps the draft and asks for a re-read", async () => {
		const write = vi.fn(async () => {
			throw changedOnDisk();
		});
		const { result, reread } = setup(write);
		act(() => result.current.setDraft("mine"));
		await act(() => result.current.save());
		expect(result.current.conflict).toBe(true);
		expect(result.current.draft).toBe("mine");
		expect(result.current.dirty).toBe(true);
		expect(result.current.error).toBeUndefined();
		expect(reread).toHaveBeenCalledOnce();
	});

	it("keepMine writes the draft again with the latest revision as its base", async () => {
		const write = vi
			.fn<WorkingCopyOptions<string>["write"]>()
			.mockRejectedValueOnce(changedOnDisk())
			.mockResolvedValueOnce({ revision: R3 });
		const { result, rerender } = setup(write);
		act(() => result.current.setDraft("mine"));
		await act(() => result.current.save());
		// The re-read brings theirs.
		rerender({ value: "theirs v2", revision: R2 });
		expect(result.current.conflict).toBe(true);
		await act(() => result.current.keepMine());
		expect(write).toHaveBeenLastCalledWith("mine", R2);
		expect(result.current.conflict).toBe(false);
		expect(result.current.dirty).toBe(false);
		rerender({ value: "mine", revision: R3 });
		expect(result.current.draft).toBe("mine");
	});

	it("takeTheirs drops the draft and the conflict", () => {
		const { result, rerender } = setup(vi.fn());
		act(() => result.current.setDraft("mine"));
		rerender({ value: "theirs v2", revision: R2 });
		act(() => result.current.takeTheirs());
		expect(result.current.conflict).toBe(false);
		expect(result.current.dirty).toBe(false);
		expect(result.current.draft).toBe("theirs v2");
	});

	it("keeps the draft and reports any other failure, without a conflict", async () => {
		const failure = new StudioFailure({
			code: ERROR_CODES.invalidInput,
			message: "The section is not valid.",
		});
		const write = vi.fn(async () => {
			throw failure;
		});
		const { result } = setup(write);
		act(() => result.current.setDraft("mine"));
		await act(() => result.current.save());
		expect(result.current.error).toBe(failure);
		expect(result.current.conflict).toBe(false);
		expect(result.current.dirty).toBe(true);
		expect(result.current.draft).toBe("mine");
	});

	it("does nothing on save without a draft", async () => {
		const write = vi.fn();
		const { result } = setup(write);
		await act(() => result.current.save());
		expect(write).not.toHaveBeenCalled();
	});

	it("answers how a save ended: clean, a conflict, or an error; a second save waits for the first", async () => {
		const answer = deferred<{ revision: Revision }>();
		const write = vi.fn(() => answer.promise);
		const { result } = setup(write);
		act(() => result.current.setDraft("mine"));
		let first: Promise<unknown> = Promise.resolve();
		let second: Promise<unknown> = Promise.resolve();
		act(() => {
			first = result.current.save();
			second = result.current.save();
		});
		expect(write).toHaveBeenCalledOnce();
		await act(async () => answer.resolve({ revision: R2 }));
		const clean = { clean: true, conflict: false, error: undefined };
		expect(await first).toEqual(clean);
		expect(await second).toEqual(clean);

		const stale = setup(vi.fn(() => Promise.reject(changedOnDisk())));
		act(() => stale.result.current.setDraft("mine"));
		let outcome: unknown;
		await act(async () => {
			outcome = await stale.result.current.save();
		});
		expect(outcome).toMatchObject({ clean: false, conflict: true });

		const failure = new StudioFailure({
			code: ERROR_CODES.unavailable,
			message: "Restart the app.",
		});
		const broken = setup(vi.fn(() => Promise.reject(failure)));
		act(() => broken.result.current.setDraft("mine"));
		await act(async () => {
			outcome = await broken.result.current.save();
		});
		expect(outcome).toEqual({ clean: false, conflict: false, error: failure });
	});
});
