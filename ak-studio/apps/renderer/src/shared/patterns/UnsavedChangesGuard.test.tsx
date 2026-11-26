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
import { act, render, screen, within } from "@testing-library/react";
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

/** One of two views on a page, each with its own working copy and guard. */
function Section({
	name,
	file,
	write,
}: {
	name: string;
	file: string;
	write: WorkingCopyOptions<string>["write"];
}) {
	const copy = useWorkingCopy({ value: `${name} theirs`, revision: R1, write });
	return (
		<div>
			<UnsavedChangesGuard
				label={`Config: ${name}`}
				what={name}
				file={file}
				workingCopy={copy}
			/>
			<p>
				{name} shows: {copy.draft}
			</p>
			<button type="button" onClick={() => copy.setDraft(`${name} mine`)}>
				Edit {name}
			</button>
		</div>
	);
}

function TwoSections({
	writeA,
	writeB,
}: {
	writeA: WorkingCopyOptions<string>["write"];
	writeB: WorkingCopyOptions<string>["write"];
}) {
	const navigate = useNavigate();
	return (
		<div>
			<Section
				name="config.yaml"
				file="src/support/config.yaml"
				write={writeA}
			/>
			<Section
				name="the session section"
				file="src/support/sessions.yaml"
				write={writeB}
			/>
			<button
				type="button" // The app registers its own routes; this test router has others.
				onClick={() => void navigate({ to: "/other" } as never)}
			>
				Leave
			</button>
		</div>
	);
}

/** Two views edited, then leaving: one dialog for both. */
async function leaveWithTwo(
	writeA: WorkingCopyOptions<string>["write"],
	writeB: WorkingCopyOptions<string>["write"],
) {
	setTransport(createMockTransport());
	const user = userEvent.setup();
	const rootRoute = createRootRoute({ component: Outlet });
	const routeTree = rootRoute.addChildren([
		createRoute({
			getParentRoute: () => rootRoute,
			path: "/",
			component: () => <TwoSections writeA={writeA} writeB={writeB} />,
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
	await user.click(
		await screen.findByRole("button", { name: "Edit config.yaml" }),
	);
	await user.click(
		screen.getByRole("button", { name: "Edit the session section" }),
	);
	await user.click(screen.getByRole("button", { name: "Leave" }));
	const dialog = await screen.findByRole("alertdialog", {
		name: "Unsaved changes in config.yaml and the session section",
	});
	// One dialog names both, with both files.
	expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
	expect(dialog.textContent).toContain("src/support/config.yaml");
	expect(dialog.textContent).toContain("src/support/sessions.yaml");
	return { user, router, dialog };
}

const written = async () => ({ revision: R2 });
const refused = () =>
	Promise.reject(
		new StudioFailure({
			code: ERROR_CODES.forbidden,
			message: "The file is read-only. Change its permissions, then save.",
		}),
	);

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

	it("ignores Escape while a save runs; a save that then fails keeps the dialog open with its error", async () => {
		let fail: (reason: unknown) => void = () => {};
		const write = vi.fn(
			() =>
				new Promise<{ revision: Revision }>((_resolve, reject) => {
					fail = reject;
				}),
		);
		const { user, router, dialog } = await leaveWithEdits(write);
		await user.click(within(dialog).getByRole("button", { name: "Save" }));
		await user.keyboard("{Escape}");
		expect(screen.getByRole("alertdialog")).toBeTruthy();
		expect(router.state.location.pathname).toBe("/");
		await act(async () =>
			fail(
				new StudioFailure({
					code: ERROR_CODES.forbidden,
					message: "The file is read-only. Change its permissions, then save.",
				}),
			),
		);
		const alert = await within(screen.getByRole("alertdialog")).findByRole(
			"alert",
		);
		expect(alert.textContent).toContain("The file is read-only.");
		expect(router.state.location.pathname).toBe("/");
	});
});

describe("UnsavedChangesGuard with two unsaved views", () => {
	it("Save saves both, then leaves", async () => {
		const writeA = vi.fn(written);
		const writeB = vi.fn(written);
		const { user, dialog } = await leaveWithTwo(writeA, writeB);
		await user.click(within(dialog).getByRole("button", { name: "Save" }));
		expect(await screen.findByText("Other view")).toBeTruthy();
		expect(writeA).toHaveBeenCalledExactlyOnceWith("config.yaml mine", R1);
		expect(writeB).toHaveBeenCalledExactlyOnceWith(
			"the session section mine",
			R1,
		);
	});

	it("Save stops at the first failure: the error shows, the navigation is held, the later view is not written", async () => {
		const writeA = vi.fn(refused);
		const writeB = vi.fn(written);
		const { user, router, dialog } = await leaveWithTwo(writeA, writeB);
		await user.click(within(dialog).getByRole("button", { name: "Save" }));
		const alert = await within(dialog).findByRole("alert");
		expect(alert.textContent).toContain("The file is read-only.");
		expect(writeB).not.toHaveBeenCalled();
		expect(router.state.location.pathname).toBe("/");
		expect(
			screen.getByText("config.yaml shows: config.yaml mine"),
		).toBeTruthy();
		expect(
			screen.getByText("the session section shows: the session section mine"),
		).toBeTruthy();
	});

	it("a view saved before a later failure stays saved and drops out of the dialog", async () => {
		const writeA = vi.fn(written);
		const writeB = vi.fn(refused);
		const { user, router } = await leaveWithTwo(writeA, writeB);
		await user.click(
			within(screen.getByRole("alertdialog")).getByRole("button", {
				name: "Save",
			}),
		);
		const dialog = await screen.findByRole("alertdialog", {
			name: "Unsaved changes in the session section",
		});
		expect(within(dialog).getByRole("alert").textContent).toContain(
			"The file is read-only.",
		);
		expect(router.state.location.pathname).toBe("/");
	});

	it("Discard drops both and leaves", async () => {
		const writeA = vi.fn(written);
		const writeB = vi.fn(written);
		const { user, dialog } = await leaveWithTwo(writeA, writeB);
		await user.click(
			within(dialog).getByRole("button", { name: "Discard changes" }),
		);
		expect(await screen.findByText("Other view")).toBeTruthy();
		expect(writeA).not.toHaveBeenCalled();
		expect(writeB).not.toHaveBeenCalled();
		expect(unsavedWork.items()).toEqual([]);
	});

	it("Stay keeps both, and nothing was dropped", async () => {
		const { user, router, dialog } = await leaveWithTwo(
			vi.fn(written),
			vi.fn(written),
		);
		await user.click(within(dialog).getByRole("button", { name: "Stay" }));
		await vi.waitFor(() =>
			expect(screen.queryByRole("alertdialog")).toBeNull(),
		);
		expect(router.state.location.pathname).toBe("/");
		expect(
			screen.getByText("config.yaml shows: config.yaml mine"),
		).toBeTruthy();
		expect(
			screen.getByText("the session section shows: the session section mine"),
		).toBeTruthy();
		expect(unsavedWork.items()).toEqual([
			"Config: config.yaml",
			"Config: the session section",
		]);
		// Leaving again asks again, once, for both.
		await user.click(screen.getByRole("button", { name: "Leave" }));
		await screen.findByRole("alertdialog", {
			name: "Unsaved changes in config.yaml and the session section",
		});
		expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
	});
});
