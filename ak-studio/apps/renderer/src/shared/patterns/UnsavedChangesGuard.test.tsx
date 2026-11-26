// The unsaved changes guard in a real router (memory history) over a real working copy: leaving with unsaved edits
// opens the dialog naming what is unsaved; Stay and Escape keep the person here with the edits; Discard drops them
// and leaves; Save writes and leaves once confirmed; a save that finds the file changed on disk, or fails, keeps the
// dialog open with what happened and the navigation held.
import { ERROR_CODES, type Revision } from "@ak-studio/contract";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
	useNavigate,
} from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudioFailure, setTransport } from "../bridge/client";
import { createMockTransport } from "../bridge/mockTransport";
import { errorStrings } from "../errors/strings";
import { unsavedWork } from "../working-copy/unsaved";
import {
	useWorkingCopy,
	type WorkingCopyOptions,
} from "../working-copy/useWorkingCopy";
import { UnsavedChangesGuard } from "./UnsavedChangesGuard";

afterEach(() => {
	setTransport(undefined);
});

const R1: Revision = "1".repeat(64);
const R2: Revision = "2".repeat(64);

function Editor({ write }: { write: WorkingCopyOptions<string>["write"] }) {
	const copy = useWorkingCopy({ value: "theirs", revision: R1, write });
	const navigate = useNavigate();
	return (
		<div>
			<UnsavedChangesGuard
				label="Config: session section"
				what="config.yaml"
				file="src/support/config.yaml"
				workingCopy={copy}
			/>
			<p>Showing: {copy.draft}</p>
			<button type="button" onClick={() => copy.setDraft("mine")}>
				Edit
			</button>
			<button
				type="button" // The app registers its own routes; this test router has others.
				onClick={() => void navigate({ to: "/other" } as never)}
			>
				Leave
			</button>
		</div>
	);
}

function renderApp(write: WorkingCopyOptions<string>["write"]) {
	const rootRoute = createRootRoute({ component: Outlet });
	const routeTree = rootRoute.addChildren([
		createRoute({
			getParentRoute: () => rootRoute,
			path: "/",
			component: () => <Editor write={write} />,
		}),
		createRoute({
			getParentRoute: () => rootRoute,
			path: "/other",
			component: () => <p>Other view</p>,
		}),
	]);
	const router = createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});
	render(<RouterProvider router={router} />);
	return router;
}

/** Edits, then tries to leave: the dialog. */
async function leaveWithEdits(write: WorkingCopyOptions<string>["write"]) {
	setTransport(createMockTransport());
	const user = userEvent.setup();
	const router = renderApp(write);
	await user.click(await screen.findByRole("button", { name: "Edit" }));
	await user.click(screen.getByRole("button", { name: "Leave" }));
	const dialog = await screen.findByRole("alertdialog", {
		name: "Unsaved changes in config.yaml",
	});
	return { user, router, dialog };
}

describe("UnsavedChangesGuard", () => {
	it("lets the person leave without asking while nothing is unsaved", async () => {
		setTransport(createMockTransport());
		const user = userEvent.setup();
		renderApp(vi.fn());
		await user.click(await screen.findByRole("button", { name: "Leave" }));
		expect(await screen.findByText("Other view")).toBeTruthy();
		expect(screen.queryByRole("alertdialog")).toBeNull();
	});

	it("names what is unsaved; Stay and Escape keep the person here with the edits", async () => {
		const { user, router, dialog } = await leaveWithEdits(vi.fn());
		expect(dialog.textContent).toContain("src/support/config.yaml");
		await user.click(within(dialog).getByRole("button", { name: "Stay" }));
		await vi.waitFor(() =>
			expect(screen.queryByRole("alertdialog")).toBeNull(),
		);
		expect(router.state.location.pathname).toBe("/");
		expect(screen.getByText("Showing: mine")).toBeTruthy();
		await user.click(screen.getByRole("button", { name: "Leave" }));
		await screen.findByRole("alertdialog");
		await user.keyboard("{Escape}");
		await vi.waitFor(() =>
			expect(screen.queryByRole("alertdialog")).toBeNull(),
		);
		expect(router.state.location.pathname).toBe("/");
		expect(unsavedWork.items()).toEqual(["Config: session section"]);
	});

	it("Discard drops the edits and leaves", async () => {
		const write = vi.fn();
		const { user, dialog } = await leaveWithEdits(write);
		await user.click(
			within(dialog).getByRole("button", { name: "Discard changes" }),
		);
		expect(await screen.findByText("Other view")).toBeTruthy();
		expect(write).not.toHaveBeenCalled();
		expect(unsavedWork.items()).toEqual([]);
	});

	it("Save writes the copy and leaves once the write is confirmed", async () => {
		let confirm: (value: { revision: Revision }) => void = () => {};
		const write = vi.fn(
			() =>
				new Promise<{ revision: Revision }>((resolve) => {
					confirm = resolve;
				}),
		);
		const { user, router, dialog } = await leaveWithEdits(write);
		await user.click(within(dialog).getByRole("button", { name: "Save" }));
		expect(write).toHaveBeenCalledExactlyOnceWith("mine", R1);
		// Not confirmed yet: still here, and Discard and Stay are disabled at once (well before the 300 ms pending
		// look), so a Discard cannot be reversed by the write landing after it.
		expect(router.state.location.pathname).toBe("/");
		expect(
			within(dialog).getByRole("button", { name: "Discard changes" }),
		).toHaveProperty("disabled", true);
		expect(within(dialog).getByRole("button", { name: "Stay" })).toHaveProperty(
			"disabled",
			true,
		);
		confirm({ revision: R2 });
		expect(await screen.findByText("Other view")).toBeTruthy();
	});

	it("a save that finds the file changed on disk keeps the dialog open, says so, and holds the navigation", async () => {
		const write = vi.fn(() =>
			Promise.reject(
				new StudioFailure({
					code: ERROR_CODES.fileChangedOnDisk,
					message: "The file changed on disk.",
				}),
			),
		);
		const { user, router, dialog } = await leaveWithEdits(write);
		await user.click(within(dialog).getByRole("button", { name: "Save" }));
		const alert = await within(dialog).findByRole("alert");
		expect(alert.textContent).toContain(errorStrings.titles.fileChangedOnDisk);
		expect(router.state.location.pathname).toBe("/");
		// Stay: the edits are still here, and the next attempt to leave asks again with no old error.
		await user.click(within(dialog).getByRole("button", { name: "Stay" }));
		await vi.waitFor(() =>
			expect(screen.queryByRole("alertdialog")).toBeNull(),
		);
		expect(screen.getByText("Showing: mine")).toBeTruthy();
		await user.click(screen.getByRole("button", { name: "Leave" }));
		const again = await screen.findByRole("alertdialog");
		expect(within(again).queryByRole("alert")).toBeNull();
	});

	it("a save that fails for another reason shows the error and stays", async () => {
		const write = vi.fn(() =>
			Promise.reject(
				new StudioFailure({
					code: ERROR_CODES.forbidden,
					message: "The file is read-only. Change its permissions, then save.",
				}),
			),
		);
		const { user, router, dialog } = await leaveWithEdits(write);
		await user.click(within(dialog).getByRole("button", { name: "Save" }));
		const alert = await within(dialog).findByRole("alert");
		expect(alert.textContent).toContain("The file is read-only.");
		expect(router.state.location.pathname).toBe("/");
	});
});
