// The shell, rendered in the providers the app uses (App: query client, theme, router) against the mock transport:
// its tabs come from the feature manifests; Mod+J (the app command shell.toggleBottomPanel) shows and hides the
// bottom panel, Ctrl+J or Cmd+J by platform, and does nothing behind a modal; and its error paths, against a
// transport that fails on purpose: the layout-save toast (a background notice; the layout stays as the person set
// it) and the bridge-error banner (shows the failure's message). Also the job patterns' hooks into the shell:
// "Show commands" (shell.showCommands) and the background job notice's toast with "Show" (about.show). The command
// palette: Ctrl+K opens it (from a text field too), it lists the commands with their features' titles, runs one,
// and holds Ctrl+J off while open; a popover (not a modal) does not.
import { studioError } from "@ak-studio/contract";
import { FakeClock } from "@ak-studio/runtime";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudioFailure, setTransport } from "../../shared/bridge/client";
import {
	createMockTransport,
	defaultMockHandlers,
} from "../../shared/bridge/mockTransport";
import { runCommand } from "../../shared/commands/runCommand";
import { errorStrings } from "../../shared/errors/strings";
import { App } from "../App";
import { registry } from "../registry";
import { shellStrings } from "./strings";

beforeEach(() => {
	// The mock reports the browser platform: shortcuts follow the navigator, here Linux (Ctrl).
	vi.spyOn(navigator, "platform", "get").mockReturnValue("Linux x86_64");
});
afterEach(() => {
	setTransport(undefined);
	vi.restoreAllMocks();
});

/** The App on the mock transport, counting app.setLayout calls; `platform` overrides what app.info reports. */
function renderApp(platform?: "darwin" | "linux") {
	const fixtures = defaultMockHandlers();
	const saved = vi.fn();
	setTransport(
		createMockTransport({
			handlers: {
				"app.info": (input) => ({
					...fixtures["app.info"](input),
					...(platform ? { platform } : {}),
				}),
				"app.setLayout": (input) => {
					saved(input.layout);
					return fixtures["app.setLayout"](input);
				},
			},
		}),
	);
	const user = userEvent.setup();
	render(<App />);
	return { user, saved };
}

const toggle = (name: "Hide the panel" | "Show the panel") =>
	screen.findByRole("button", { name });

describe("Shell tabs", () => {
	it("renders its tabs from the feature manifests, in order, each opening its feature's screen", async () => {
		const { user } = renderApp();
		const tablist = await screen.findByRole("tablist", {
			name: "Project views",
		});
		// Under happy-dom React Aria's collection pass also lists the bottom panel's three tabs after these (so does
		// DesktopShell with its default tabs; a real browser does not, and the e2e checks the exact five there).
		expect(
			within(tablist)
				.getAllByRole("tab")
				.map((tab) => tab.textContent),
		).toEqual([
			...registry.tabs.map((tab) => tab.label),
			"Problems",
			"Run log",
			"Commands",
		]);
		await user.click(within(tablist).getByRole("tab", { name: "Deploy" }));
		const panel = await screen.findByRole("tabpanel", { name: "Deploy" });
		expect(
			within(panel).getByRole("heading", { name: "Deploy", level: 2 }),
		).toBeTruthy();
		expect(window.location.hash).toBe("#/deploy");
	});
});

describe("Shell shortcuts", () => {
	it("shows and hides the bottom panel with Ctrl+J on Linux, and saves the layout", async () => {
		const { user, saved } = renderApp();
		const hide = await toggle("Hide the panel");
		expect(hide.getAttribute("aria-keyshortcuts")).toBe("Control+J");
		await user.keyboard("{Meta>}j{/Meta}");
		expect(screen.queryByRole("button", { name: "Show the panel" })).toBeNull();
		await user.keyboard("{Control>}j{/Control}");
		expect(await toggle("Show the panel")).toBeTruthy();
		await waitFor(() =>
			expect(saved).toHaveBeenLastCalledWith(
				expect.objectContaining({
					bottomPanel: expect.objectContaining({ open: false }),
				}),
			),
		);
		await user.keyboard("{Control>}j{/Control}");
		expect(await toggle("Hide the panel")).toBeTruthy();
	});

	it("uses Cmd+J on macOS, and shows it as ⌘J", async () => {
		const { user } = renderApp("darwin");
		const hide = await toggle("Hide the panel");
		expect(hide.getAttribute("aria-keyshortcuts")).toBe("Meta+J");
		await user.keyboard("{Control>}j{/Control}");
		expect(screen.queryByRole("button", { name: "Show the panel" })).toBeNull();
		await user.keyboard("{Meta>}j{/Meta}");
		expect(await toggle("Show the panel")).toBeTruthy();
	});

	it("does nothing behind a modal: Ctrl+J with Settings open leaves the panel as it is", async () => {
		const { user, saved } = renderApp();
		await toggle("Hide the panel");
		await user.click(screen.getByRole("button", { name: "Settings" }));
		await screen.findByRole("dialog", { name: "Settings" });
		await user.keyboard("{Control>}j{/Control}");
		expect(
			screen.getByRole("button", { name: "Hide the panel", hidden: true }),
		).toBeTruthy();
		expect(saved).not.toHaveBeenCalled();
		// Closed again, the shortcut acts.
		await user.keyboard("{Escape}");
		await waitFor(() =>
			expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull(),
		);
		await user.keyboard("{Control>}j{/Control}");
		expect(await toggle("Show the panel")).toBeTruthy();
	});
});

describe("Shell command palette", () => {
	it("opens on Ctrl+K, even from a text field, listing each command with its feature's title and shortcut", async () => {
		const { user } = renderApp();
		await toggle("Hide the panel");
		await user.keyboard("{Control>}k{/Control}");
		const dialog = await screen.findByRole("dialog", {
			name: "Command palette",
		});
		const names = within(dialog)
			.getAllByRole("option")
			.map((row) => row.textContent);
		expect(names).toContain("View: Show or hide the panelCtrl+J");
		expect(names).toContain("About: Run the demo job");
		// Not its own command: it is open already.
		expect(names.some((name) => name?.includes("command palette"))).toBe(false);
		// Typing goes to the search field; Ctrl+J does nothing while the palette (a modal) is open.
		await user.keyboard("{Control>}j{/Control}");
		expect(
			screen.getByRole("button", { name: "Hide the panel", hidden: true }),
		).toBeTruthy();
		await user.keyboard("{Escape}");
		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: "Command palette" }),
			).toBeNull(),
		);
		// From a text field too (Mod+K types nothing).
		const field = document.createElement("input");
		document.body.append(field);
		field.focus();
		await user.keyboard("{Control>}k{/Control}");
		expect(
			await screen.findByRole("dialog", { name: "Command palette" }),
		).toBeTruthy();
		field.remove();
	});

	it("runs the chosen command after it closes", async () => {
		const { user } = renderApp();
		await toggle("Hide the panel");
		await user.keyboard("{Control>}k{/Control}");
		const dialog = await screen.findByRole("dialog", {
			name: "Command palette",
		});
		await user.click(
			within(dialog).getByRole("option", {
				name: "View: Show or hide the panel",
			}),
		);
		expect(await toggle("Show the panel")).toBeTruthy();
		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: "Command palette" }),
			).toBeNull(),
		);
	});

	it("shows a command that fails after the palette closed in a toast: what happened, then what to do", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		setTransport(
			createMockTransport({
				handlers: {
					"about.demoJob": () => {
						throw new StudioFailure(
							studioError(
								"bridge.unavailable",
								"Restart the app and try again.",
							),
						);
					},
				},
			}),
		);
		const user = userEvent.setup();
		render(<App />);
		await toggle("Hide the panel");
		await user.keyboard("{Control>}k{/Control}");
		const dialog = await screen.findByRole("dialog", {
			name: "Command palette",
		});
		await user.click(
			within(dialog).getByRole("option", { name: "About: Run the demo job" }),
		);
		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: "Command palette" }),
			).toBeNull(),
		);
		expect(
			await screen.findByText(errorStrings.titles.unavailable),
		).toBeTruthy();
		expect(screen.getByText("Restart the app and try again.")).toBeTruthy();
	});

	it("leaves Ctrl+J working while a popover (not a modal) is open", async () => {
		const { user } = renderApp();
		await toggle("Hide the panel");
		await user.click(screen.getByRole("button", { name: "Build with AI" }));
		await screen.findByRole("dialog", { name: "Build with AI" });
		await user.keyboard("{Control>}j{/Control}");
		expect(await toggle("Show the panel")).toBeTruthy();
	});
});

describe("Shell error paths", () => {
	it("tells the person when the layout could not be saved, and keeps the layout they set", async () => {
		const failures = vi.fn();
		setTransport(
			createMockTransport({
				handlers: {
					"app.setLayout": () => {
						failures();
						throw new StudioFailure(
							studioError("app.preferencesNotSaved", "Disk full"),
						);
					},
				},
			}),
		);
		const user = userEvent.setup();
		render(<App />);

		// The panel starts open (the default layout); hiding it is the person's layout change.
		await user.click(
			await screen.findByRole("button", { name: "Hide the panel" }),
		);

		expect(
			await screen.findByText(shellStrings.layoutNotSaved.title),
		).toBeTruthy();
		expect(failures).toHaveBeenCalledOnce();
		// Not reverted: the panel stays hidden although the save failed.
		expect(screen.getByRole("button", { name: "Show the panel" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Hide the panel" })).toBeNull();
	});

	it("shows the bridge error's message in a banner when app.info fails", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		setTransport(
			createMockTransport({
				handlers: {
					"app.info": () => {
						throw new StudioFailure(
							studioError("app.unavailable", "The bridge did not answer"),
						);
					},
				},
			}),
		);
		render(<App />);

		expect(await screen.findByText("The bridge did not answer")).toBeTruthy();
		expect(screen.getByText(shellStrings.bridgeError)).toBeTruthy();
	});
});

describe("Shell and the job patterns", () => {
	it("shell.showCommands opens the bottom panel on the Commands view", async () => {
		const { user } = renderApp();
		await user.click(await toggle("Hide the panel"));
		await toggle("Show the panel");
		await act(() => runCommand("shell.showCommands"));
		await toggle("Hide the panel");
		const panelTabs = screen.getByRole("tablist", { name: "Panel views" });
		expect(
			within(panelTabs)
				.getByRole("tab", { name: "Commands" })
				.getAttribute("aria-selected"),
		).toBe("true");
	});

	it("a job waiting off screen raises its toast; Show runs the owner's show command and opens its screen", async () => {
		const clock = new FakeClock();
		setTransport(createMockTransport({ clock }));
		const user = userEvent.setup();
		render(<App />);
		await screen.findByRole("tablist", { name: "Project views" });
		expect(window.location.hash).not.toBe("#/about");
		await act(() => runCommand("about.runDemoJob"));
		await act(() => clock.advance(2000));
		const toast = await screen.findByRole("alertdialog", {
			name: /Demo job is waiting for you/,
		});
		expect(toast.textContent).toContain("Run the last step?");
		await user.click(within(toast).getByRole("button", { name: "Show" }));
		await waitFor(() => expect(window.location.hash).toBe("#/about"));
	});
});
