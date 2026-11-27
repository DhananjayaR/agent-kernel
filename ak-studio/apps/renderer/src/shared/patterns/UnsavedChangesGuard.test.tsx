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
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudioFailure, setTransport } from "../bridge/client";
import { createMockTransport } from "../bridge/mockTransport";
import { errorStrings } from "../errors/strings";
import { PENDING_DELAY_MS } from "../query/pending";
import { unsavedWork } from "../working-copy/unsaved";
import {
	useWorkingCopy,
	type WorkingCopyOptions,
} from "../working-copy/useWorkingCopy";
import { SAVE_STUCK_MS, UnsavedChangesGuard } from "./UnsavedChangesGuard";

afterEach(() => {
	setTransport(undefined);
});

const R1: Revision = "1".repeat(64);
const R2: Revision = "2".repeat(64);
const R3: Revision = "3".repeat(64);

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
			<button
				type="button"
				onClick={() => {
					void copy.save();
				}}
			>
				Save {name}
			</button>
		</div>
	);
}

function TwoSections({
	writeA,
	writeB,
	fileB,
}: {
	writeA: WorkingCopyOptions<string>["write"];
	writeB: WorkingCopyOptions<string>["write"];
	fileB: string;
}) {
	const navigate = useNavigate();
	return (
		<div>
			<Section
				name="config.yaml"
				file="src/support/config.yaml"
				write={writeA}
			/>
			<Section name="the session section" file={fileB} write={writeB} />
			<button
				type="button" // The app registers its own routes; this test router has others.
				onClick={() => void navigate({ to: "/other" } as never)}
			>
				Leave
			</button>
		</div>
	);
}

/** Two views on one page, rendered. */
async function renderTwo(
	writeA: WorkingCopyOptions<string>["write"],
	writeB: WorkingCopyOptions<string>["write"],
	fileB = "src/support/sessions.yaml",
) {
	setTransport(createMockTransport());
	const user = userEvent.setup();
	const rootRoute = createRootRoute({ component: Outlet });
	const routeTree = rootRoute.addChildren([
		createRoute({
			getParentRoute: () => rootRoute,
			path: "/",
			component: () => (
				<TwoSections writeA={writeA} writeB={writeB} fileB={fileB} />
			),
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
	return { user, router };
}

/** Two views edited, then leaving: one dialog for both. */
async function leaveWithTwo(
	writeA: WorkingCopyOptions<string>["write"],
	writeB: WorkingCopyOptions<string>["write"],
) {
	const { user, router } = await renderTwo(writeA, writeB);
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

/** A write that waits for the test to answer it. */
function deferredWrite() {
	let answer: (value: { revision: Revision }) => void = () => {};
	const write = vi.fn(
		(_draft: string, _base: Revision) =>
			new Promise<{ revision: Revision }>((resolve) => {
				answer = resolve;
			}),
	);
	return { write, answer: (value: { revision: Revision }) => answer(value) };
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

	it("holds Discard, Stay and Escape while a view's own save runs; the choices return once it lands", async () => {
		const a = deferredWrite();
		const writeB = vi.fn(written);
		const { user, router } = await renderTwo(a.write, writeB);
		// The view saves itself (Keep mine, an explicit Save, an autosave), and the person leaves before it lands.
		await user.click(screen.getByRole("button", { name: "Save config.yaml" }));
		await user.click(screen.getByRole("button", { name: "Leave" }));
		const dialog = await screen.findByRole("alertdialog", {
			name: "Unsaved changes in config.yaml and the session section",
		});
		expect(
			within(dialog).getByRole("button", { name: "Discard changes" }),
		).toHaveProperty("disabled", true);
		expect(within(dialog).getByRole("button", { name: "Stay" })).toHaveProperty(
			"disabled",
			true,
		);
		await user.keyboard("{Escape}");
		expect(screen.getByRole("alertdialog")).toBeTruthy();
		await act(async () => a.answer({ revision: R2 }));
		const after = await screen.findByRole("alertdialog", {
			name: "Unsaved changes in the session section",
		});
		expect(
			within(after).getByRole("button", { name: "Discard changes" }),
		).toHaveProperty("disabled", false);
		expect(router.state.location.pathname).toBe("/");
	});

	it("names each file once when two views show the same file, and names the view whose save conflicts", async () => {
		const writeB = vi.fn(() =>
			Promise.reject(
				new StudioFailure({
					code: ERROR_CODES.fileChangedOnDisk,
					message: "The file changed on disk.",
				}),
			),
		);
		const { user, router } = await renderTwo(
			vi.fn(written),
			writeB,
			"src/support/config.yaml",
		);
		await user.click(screen.getByRole("button", { name: "Leave" }));
		const dialog = await screen.findByRole("alertdialog", {
			name: "Unsaved changes in config.yaml and the session section",
		});
		expect(dialog.querySelectorAll("[data-slot=path-chip]")).toHaveLength(1);
		await user.click(within(dialog).getByRole("button", { name: "Save" }));
		// The second view's base is stale once the first wrote the file: a conflict, naming that view.
		const alert = await within(
			await screen.findByRole("alertdialog", {
				name: "Unsaved changes in the session section",
			}),
		).findByRole("alert");
		expect(alert.textContent).toContain(errorStrings.titles.fileChangedOnDisk);
		expect(alert.textContent).toContain(
			"The file behind the session section changed while you were editing.",
		);
		expect(alert.textContent).toContain("src/support/config.yaml");
		expect(router.state.location.pathname).toBe("/");
	});
});

describe("UnsavedChangesGuard while a view's own save runs", () => {
	it("leaves by itself when every copy turns clean while it asks", async () => {
		const a = deferredWrite();
		const b = deferredWrite();
		const { user } = await renderTwo(a.write, b.write);
		await user.click(screen.getByRole("button", { name: "Save config.yaml" }));
		await user.click(
			screen.getByRole("button", { name: "Save the session section" }),
		);
		await user.click(screen.getByRole("button", { name: "Leave" }));
		await screen.findByRole("alertdialog");
		await act(async () => {
			a.answer({ revision: R2 });
			b.answer({ revision: R2 });
		});
		expect(await screen.findByText("Other view")).toBeTruthy();
	});

	it("a dialog Save waits for a running save, and writes again if the copy changed meanwhile", async () => {
		let first: (value: { revision: Revision }) => void = () => {};
		const writeA = vi
			.fn<WorkingCopyOptions<string>["write"]>()
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						first = resolve;
					}),
			)
			.mockResolvedValueOnce({ revision: R3 });
		const { user } = await renderTwo(writeA, vi.fn(written));
		await user.click(screen.getByRole("button", { name: "Save config.yaml" }));
		// An edit while that save runs: the copy changes under it.
		await user.click(screen.getByRole("button", { name: "Edit config.yaml" }));
		await user.click(screen.getByRole("button", { name: "Leave" }));
		const dialog = await screen.findByRole("alertdialog");
		await user.click(within(dialog).getByRole("button", { name: "Save" }));
		await act(async () => first({ revision: R2 }));
		expect(await screen.findByText("Other view")).toBeTruthy();
		expect(writeA).toHaveBeenCalledTimes(2);
		expect(writeA).toHaveBeenLastCalledWith("config.yaml mine", R2);
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("offers Stay again when a save runs far too long; staying keeps the work", async () => {
		const a = deferredWrite();
		const { router } = await renderTwo(a.write, vi.fn(written));
		// Fake timeouts from before the save starts, so its pending clocks are fake; presses by fireEvent.
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		let stay: HTMLElement;
		let dialog: HTMLElement;
		try {
			fireEvent.click(screen.getByRole("button", { name: "Save config.yaml" }));
			fireEvent.click(screen.getByRole("button", { name: "Leave" }));
			await act(async () => {
				await vi.advanceTimersByTimeAsync(10);
			});
			dialog = screen.getByRole("alertdialog");
			stay = within(dialog).getByRole("button", { name: "Stay" });
			expect(stay).toHaveProperty("disabled", true);
			await act(async () => {
				await vi.advanceTimersByTimeAsync(PENDING_DELAY_MS + SAVE_STUCK_MS);
			});
		} finally {
			vi.useRealTimers();
		}
		expect(stay).toHaveProperty("disabled", false);
		expect(dialog.textContent).toContain(
			"Saving is taking longer than it should.",
		);
		fireEvent.click(stay);
		await vi.waitFor(() =>
			expect(screen.queryByRole("alertdialog")).toBeNull(),
		);
		expect(router.state.location.pathname).toBe("/");
		expect(
			screen.getByText("the session section shows: the session section mine"),
		).toBeTruthy();
	});
});
