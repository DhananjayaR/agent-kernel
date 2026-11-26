// The command palette's rows from the app's commands (paletteItems): each title with its feature's title as a
// prefix, in order; the shortcut in the platform's form; a `when`-false command left out; a version-gated one
// listed with the version gate's reason (and refused by runCommand); the palette's own command left out. Then the
// connected palette in happy-dom: a gated row does not run, a runnable one runs after the palette closes, and a
// command that fails is logged.
import type { CapabilityCatalog } from "@ak-studio/kernel-catalog";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCapabilityScope } from "../capability/capability";
import { defineCommand } from "../commands/command";
import {
	CommandUnavailableError,
	getCommands,
	runCommand,
	setCommands,
} from "../commands/runCommand";
import {
	CommandPalette,
	type PaletteCommand,
	paletteItems,
} from "./CommandPalette";

const appCommands = getCommands();
const initialScope = useCapabilityScope.getState();
afterEach(() => {
	setCommands(appCommands);
	useCapabilityScope.setState(initialScope, true);
	vi.restoreAllMocks();
});

/** Knows `deploy.azure`, added in OAK 0.12.0. */
const catalog: CapabilityCatalog = {
	has: (id) => id === "deploy.azure",
	get: (id) =>
		id === "deploy.azure" ? { id, title: "Azure", since: "0.12.0" } : undefined,
	status: (_id, version) =>
		Number(version.split(".")[1]) >= 12 ? "available" : "needs-upgrade",
};

function fixture() {
	const toggle = vi.fn();
	const deploy = vi.fn();
	const fails = vi.fn(() => {
		throw new Error("disk full");
	});
	const commands: PaletteCommand[] = [
		{
			featureTitle: "View",
			command: defineCommand({
				id: "shell.toggle",
				title: "Show or hide the panel",
				shortcut: "Mod+J",
				run: toggle,
			}),
		},
		{
			featureTitle: "View",
			command: defineCommand({
				id: "shell.open",
				title: "Show the command palette",
				shortcut: "Mod+K",
				run: () => {},
			}),
		},
		{
			featureTitle: "View",
			command: defineCommand({
				id: "shell.hidden",
				title: "Hidden",
				when: () => false,
				run: () => {},
			}),
		},
		{
			featureTitle: "Deploy",
			command: defineCommand({
				id: "deploy.toAzure",
				title: "Deploy to Azure",
				capability: "deploy.azure",
				run: deploy,
			}),
		},
		{
			featureTitle: "About",
			command: defineCommand({ id: "about.fails", title: "Fail", run: fails }),
		},
	];
	setCommands(commands.map((entry) => entry.command));
	// The catalog knows the capability; no project version yet, so nothing is gated.
	useCapabilityScope.setState({ catalog, version: undefined });
	return { commands, toggle, deploy, fails };
}

describe("paletteItems", () => {
	it("prefixes each title with its feature's, keeps the order, shows shortcuts per platform, and leaves out `when`-false and excluded commands", () => {
		const { commands } = fixture();
		expect(paletteItems(commands, "other", "shell.open")).toEqual([
			{
				id: "shell.toggle",
				title: "View: Show or hide the panel",
				shortcut: { label: "Ctrl+J", aria: "Control+J" },
			},
			{ id: "deploy.toAzure", title: "Deploy: Deploy to Azure" },
			{ id: "about.fails", title: "About: Fail" },
		]);
		expect(paletteItems(commands, "mac")[0]?.shortcut).toEqual({
			label: "⌘J",
			aria: "Meta+J",
		});
		expect(paletteItems(commands, "mac").map((item) => item.id)).toContain(
			"shell.open",
		);
	});

	it("lists a command the project's OAK version lacks with the version gate's reason, and runCommand refuses it", async () => {
		const { commands, deploy } = fixture();
		useCapabilityScope.setState({ catalog, version: "0.11.4" });
		expect(
			paletteItems(commands, "other").find(
				(item) => item.id === "deploy.toAzure",
			),
		).toEqual({
			id: "deploy.toAzure",
			title: "Deploy: Deploy to Azure",
			unavailable: "Needs OAK 0.12.0",
		});
		await expect(runCommand("deploy.toAzure")).rejects.toBeInstanceOf(
			CommandUnavailableError,
		);
		expect(deploy).not.toHaveBeenCalled();
		useCapabilityScope.setState({ catalog, version: "0.12.1" });
		expect(
			paletteItems(commands, "other").find(
				(item) => item.id === "deploy.toAzure",
			)?.unavailable,
		).toBeUndefined();
	});
});

describe("CommandPalette", () => {
	function show(commands: readonly PaletteCommand[]) {
		const onOpenChange = vi.fn();
		const user = userEvent.setup();
		render(
			<CommandPalette
				isOpen
				onOpenChange={onOpenChange}
				commands={commands}
				platform="other"
			/>,
		);
		const dialog = screen.getByRole("dialog", { name: "Command palette" });
		return { user, onOpenChange, dialog };
	}

	it("runs a command after closing; a gated one stays listed and does not run", async () => {
		const { commands, toggle, deploy } = fixture();
		useCapabilityScope.setState({ catalog, version: "0.10.0" });
		const { user, onOpenChange, dialog } = show(commands);
		const gated = within(dialog).getByRole("menuitem", {
			name: "Deploy: Deploy to Azure",
		});
		expect(gated.textContent).toContain("Needs OAK 0.12.0");
		await user.click(gated);
		expect(deploy).not.toHaveBeenCalled();
		expect(onOpenChange).not.toHaveBeenCalled();
		await user.click(
			within(dialog).getByRole("menuitem", {
				name: "View: Show or hide the panel",
			}),
		);
		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(toggle).toHaveBeenCalledOnce();
	});

	it("logs a command that fails, as a shortcut's failure is", async () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const { commands, fails } = fixture();
		const { user, dialog } = show(commands);
		await user.click(
			within(dialog).getByRole("menuitem", { name: "About: Fail" }),
		);
		expect(fails).toHaveBeenCalledOnce();
		await waitFor(() =>
			expect(log).toHaveBeenCalledWith(
				"[studio] command about.fails failed: disk full",
			),
		);
	});
});
