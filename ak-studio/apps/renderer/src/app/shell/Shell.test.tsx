// The shell, rendered in the providers the app uses (App: query client, theme, router) against the mock transport:
// its tabs come from the feature manifests; Mod+J (the app command shell.toggleBottomPanel) shows and hides the
// bottom panel, Ctrl+J or Cmd+J by platform, and does nothing behind a modal; and its error paths, against a
// transport that fails on purpose: the layout-save toast (a background notice; the layout stays as the person set
// it) and the bridge-error banner (shows the failure's message).
import { studioError } from "@ak-studio/contract";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudioFailure, setTransport } from "../../shared/bridge/client";
import {
	createMockTransport,
	defaultMockHandlers,
} from "../../shared/bridge/mockTransport";
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
