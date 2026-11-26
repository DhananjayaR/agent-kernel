// useAboutSetNote's test: the hook calls `about.setNote` through the mock transport, which serves it as the app
// does (the feature's service behind a real registry). A write on the current revision answers the new one; a
// stale one fails with `file.changedOnDisk` and no content, and the working-copy helper keeps the copy, flags the
// conflict and re-reads `about.note` for "theirs".
import type { StudioFailure } from "@ak-studio/contract";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useWorkingCopy } from "../../../shared/working-copy/useWorkingCopy";
import { type ConnectedMock, connectMock } from "../../../test/connectedMock";
import { useAboutNote } from "./useAboutNote";
import { useAboutSetNote } from "./useAboutSetNote";

const EMPTY_REVISION =
	"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

let mock: ConnectedMock | undefined;
afterEach(() => {
	mock?.dispose();
	mock = undefined;
});

describe("useAboutSetNote", () => {
	it("writes with about.setNote on the current revision, and answers the new revision", async () => {
		mock = connectMock();
		const { result } = renderHook(() => useAboutSetNote(), {
			wrapper: mock.wrapper,
		});
		await act(async () => {
			await expect(
				result.current.mutateAsync({
					note: "hello",
					baseRevision: EMPTY_REVISION,
				}),
			).resolves.toEqual({
				revision:
					"2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
			});
		});
	});

	it("fails a stale write with file.changedOnDisk, carrying no content", async () => {
		mock = connectMock();
		await mock.backend.transport.request("about.setNote", {
			note: "theirs",
			baseRevision: EMPTY_REVISION,
		});
		const { result } = renderHook(() => useAboutSetNote(), {
			wrapper: mock.wrapper,
		});
		let failure: StudioFailure["error"] | undefined;
		await act(async () => {
			await result.current
				.mutateAsync({ note: "mine", baseRevision: EMPTY_REVISION })
				.catch((err: { error: StudioFailure["error"] }) => {
					failure = err.error;
				});
		});
		expect(failure?.code).toBe("file.changedOnDisk");
		expect(JSON.stringify(failure)).not.toContain("theirs");
		await waitFor(() => expect(result.current.isError).toBe(true));
	});

	it("keeps a working copy through a stale write, flags the conflict and re-reads theirs", async () => {
		mock = connectMock();
		const { result } = renderHook(
			() => {
				const note = useAboutNote();
				const setNote = useAboutSetNote();
				const copy = useWorkingCopy({
					value: note.data?.note,
					revision: note.data?.revision,
					write: (draft, baseRevision) =>
						setNote.mutateAsync({ note: draft, baseRevision }),
					reread: () => note.refetch(),
				});
				return { note, copy };
			},
			{ wrapper: mock.wrapper },
		);
		await waitFor(() => expect(result.current.note.isSuccess).toBe(true));
		act(() => result.current.copy.setDraft("mine"));
		// Someone else writes first.
		await mock.backend.transport.request("about.setNote", {
			note: "theirs",
			baseRevision: EMPTY_REVISION,
		});
		await act(() => result.current.copy.save());
		expect(result.current.copy.conflict).toBe(true);
		expect(result.current.copy.draft).toBe("mine");
		await waitFor(() => expect(result.current.note.data?.note).toBe("theirs"));
		await act(() => result.current.copy.keepMine());
		await waitFor(() => expect(result.current.note.data?.note).toBe("mine"));
		expect(result.current.copy.conflict).toBe(false);
	});
});
