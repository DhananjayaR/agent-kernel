// useAboutNote's test: the hook calls `about.note` through the mock transport, which serves it as the app does (the
// feature's service behind a real registry). A write announces `domain.changed` for `about`, and the events
// subscription (wired as App.tsx wires it) refreshes the query: no optimistic write, no manual invalidation.
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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

describe("useAboutNote", () => {
	it("reads about.note: empty, at the SHA-256 of the empty text", async () => {
		mock = connectMock();
		const { result } = renderHook(() => useAboutNote(), {
			wrapper: mock.wrapper,
		});
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual({
			note: "",
			revision: EMPTY_REVISION,
		});
	});

	it("re-reads the note when a write announces the change", async () => {
		mock = connectMock();
		const { result } = renderHook(
			() => ({ note: useAboutNote(), setNote: useAboutSetNote() }),
			{ wrapper: mock.wrapper },
		);
		await waitFor(() => expect(result.current.note.isSuccess).toBe(true));
		let revision = "";
		await act(async () => {
			({ revision } = await result.current.setNote.mutateAsync({
				note: "Shipped on Friday",
				baseRevision: EMPTY_REVISION,
			}));
		});
		await waitFor(() =>
			expect(result.current.note.data).toEqual({
				note: "Shipped on Friday",
				revision,
			}),
		);
	});
});
