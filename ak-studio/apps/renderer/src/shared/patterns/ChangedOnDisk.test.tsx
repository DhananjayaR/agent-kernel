// The changed-on-disk pattern over a real working copy: a file that changes underneath the person's edits shows the
// warning banner, "Take theirs" drops the copy and "Keep mine" writes it on the new revision; "Compare" shows only
// once its app command exists, and runs it with the file; with no working copy, a re-read file shows the info banner
// until dismissed, and nothing shows otherwise.
import { ERROR_CODES, type Revision } from "@ak-studio/contract";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { StudioFailure } from "../bridge/client";
import { defineCommand } from "../commands/command";
import { getCommands, setCommands } from "../commands/runCommand";
import { errorStrings } from "../errors/strings";
import {
	useWorkingCopy,
	type WorkingCopyOptions,
} from "../working-copy/useWorkingCopy";
import { ChangedOnDisk, COMPARE_FILE_COMMAND } from "./ChangedOnDisk";

const appCommands = getCommands();
afterEach(() => {
	setCommands(appCommands);
});

const R1: Revision = "1".repeat(64);
const R2: Revision = "2".repeat(64);
const R3: Revision = "3".repeat(64);

function Editor(props: {
	value: string;
	revision: Revision;
	write: WorkingCopyOptions<string>["write"];
}) {
	const copy = useWorkingCopy(props);
	return (
		<div>
			<ChangedOnDisk file="src/support/config.yaml" workingCopy={copy} />
			<p>Showing: {copy.draft}</p>
			<button type="button" onClick={() => copy.setDraft("mine")}>
				Edit
			</button>
		</div>
	);
}

/** An editor with an edit made on R1, then the file changed on disk to R2. */
async function conflicted(
	write: WorkingCopyOptions<string>["write"] = vi.fn(async () => ({
		revision: R3,
	})),
) {
	const user = userEvent.setup();
	const view = render(<Editor value="theirs v1" revision={R1} write={write} />);
	await user.click(screen.getByRole("button", { name: "Edit" }));
	expect(screen.queryByRole("status")).toBeNull();
	view.rerender(<Editor value="theirs v2" revision={R2} write={write} />);
	return { user, view, write };
}

describe("ChangedOnDisk", () => {
	it("warns when the file changes under the working copy; Take theirs drops the copy", async () => {
		const { user } = await conflicted();
		const banner = screen.getByRole("status");
		expect(banner.dataset.tone).toBe("warning");
		expect(banner.textContent).toContain(
			"File changed on disk while you were editing",
		);
		expect(banner.textContent).toContain("src/support/config.yaml");
		expect(screen.getByText("Showing: mine")).toBeTruthy();
		// No compare view yet: no "Compare".
		expect(screen.queryByRole("button", { name: "Compare" })).toBeNull();
		await user.click(screen.getByRole("button", { name: "Take theirs" }));
		expect(screen.queryByRole("status")).toBeNull();
		expect(screen.getByText("Showing: theirs v2")).toBeTruthy();
	});

	it("Keep mine writes the copy on the new revision, and the banner goes", async () => {
		const { user, write } = await conflicted();
		await user.click(screen.getByRole("button", { name: "Keep mine" }));
		expect(write).toHaveBeenCalledExactlyOnceWith("mine", R2);
		await act(async () => {});
		expect(screen.queryByRole("status")).toBeNull();
	});

	it("keeps the banner while a Keep mine save runs, with Take theirs disabled, so the write cannot reverse a choice", async () => {
		let answer: (value: { revision: Revision }) => void = () => {};
		const write = vi.fn(
			() =>
				new Promise<{ revision: Revision }>((resolve) => {
					answer = resolve;
				}),
		);
		const { user } = await conflicted(write);
		await user.click(screen.getByRole("button", { name: "Keep mine" }));
		expect(screen.getByRole("button", { name: "Take theirs" })).toHaveProperty(
			"disabled",
			true,
		);
		// A second press is not a second write.
		await user.click(screen.getByRole("button", { name: "Keep mine" }));
		expect(write).toHaveBeenCalledOnce();
		await act(async () => answer({ revision: R3 }));
		expect(screen.queryByRole("status")).toBeNull();
		expect(screen.getByText("Showing: mine")).toBeTruthy();
	});

	it("shows a Keep mine that fails for another reason, keeps the banner and the copy, and Keep mine tries again", async () => {
		const write = vi
			.fn<WorkingCopyOptions<string>["write"]>()
			.mockRejectedValueOnce(
				new StudioFailure({
					code: ERROR_CODES.unavailable,
					message: "Restart the app, then keep yours again.",
				}),
			)
			.mockResolvedValueOnce({ revision: R3 });
		const { user } = await conflicted(write);
		await user.click(screen.getByRole("button", { name: "Keep mine" }));
		const alert = await screen.findByRole("alert");
		expect(alert.textContent).toContain(errorStrings.titles.unavailable);
		expect(alert.textContent).toContain(
			"Restart the app, then keep yours again.",
		);
		expect(screen.getByRole("status").dataset.tone).toBe("warning");
		expect(screen.getByText("Showing: mine")).toBeTruthy();
		await user.click(screen.getByRole("button", { name: "Keep mine" }));
		expect(write).toHaveBeenLastCalledWith("mine", R2);
		await vi.waitFor(() => expect(screen.queryByRole("status")).toBeNull());
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("offers Compare once its app command exists, and runs it with the file", async () => {
		const run = vi.fn();
		setCommands([
			defineCommand({
				id: COMPARE_FILE_COMMAND,
				title: "Compare with the file on disk",
				args: z.strictObject({ file: z.string() }),
				run,
			}),
		]);
		const { user } = await conflicted();
		await user.click(screen.getByRole("button", { name: "Compare" }));
		await vi.waitFor(() =>
			expect(run).toHaveBeenCalledExactlyOnceWith({
				file: "src/support/config.yaml",
			}),
		);
	});

	it("with no working copy: the info banner while the view says it re-read the file, until dismissed", async () => {
		const onDismiss = vi.fn();
		const user = userEvent.setup();
		const view = render(<ChangedOnDisk file="src/support/app.py" />);
		expect(view.container.textContent).toBe("");
		view.rerender(
			<ChangedOnDisk
				file="src/support/app.py"
				changed
				onDismiss={onDismiss}
				description="The canvas was updated."
			/>,
		);
		const banner = screen.getByRole("status");
		expect(banner.dataset.tone).toBe("info");
		expect(banner.textContent).toContain("The canvas was updated.");
		await user.click(screen.getByRole("button", { name: "Dismiss" }));
		expect(onDismiss).toHaveBeenCalledOnce();
	});
});
