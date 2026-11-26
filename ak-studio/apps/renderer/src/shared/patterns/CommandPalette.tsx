// CommandPalette: the command palette over the app's command list (P1b design gate row (b); the pattern catalogue:
// "one shortcut; built from the app commands in manifests; shows each command's shortcut"). The Shell mounts it and
// opens it with shell.openCommandPalette (Mod+K); the registry hands it every command with its feature's title
// (shared/ cannot read the registry), and it fills CommandPaletteView:
// - each command's title with its feature's title as a prefix ("About: Run the demo job"), in manifest order;
// - its shortcut in the platform's form ("Ctrl+J", "⌘J") and in aria-keyshortcuts form;
// - a command whose `when` is false is left out (it does not apply to what is on screen); one whose kernel
//   capability the project's OAK version lacks is listed with the version gate's reason and does not run
//   (commandGate; runCommand refuses it too);
// - the palette's own command is left out: it is open already.
// The list is read each time the palette renders, so `when` is asked as it opens. A command is run through
// runCommand after the palette has closed; a command that fails is logged, as a shortcut's failure is (the command
// itself shows what went wrong, as its own feedback).
import { type CommandPaletteItem, CommandPaletteView } from "@ak-studio/ui";
import type { AppCommand } from "../commands/command";
import { commandGate, runCommand } from "../commands/runCommand";
import { describeShortcut, type ShortcutPlatform } from "../commands/shortcuts";

/** One app command and the title of the feature that declares it. */
export interface PaletteCommand {
	command: AppCommand;
	featureTitle: string;
}

/** The palette's rows for `commands` on `platform`: the rules in the header. */
export function paletteItems(
	commands: readonly PaletteCommand[],
	platform: ShortcutPlatform,
	exclude?: string,
): CommandPaletteItem[] {
	const items: CommandPaletteItem[] = [];
	for (const { command, featureTitle } of commands) {
		if (command.id === exclude) continue;
		if (command.when && !command.when()) continue;
		const gate = commandGate(command);
		items.push({
			id: command.id,
			title: `${featureTitle}: ${command.title}`,
			...(command.shortcut
				? { shortcut: describeShortcut(command.shortcut, platform) }
				: {}),
			...(gate.available ? {} : { unavailable: gate.reason }),
		});
	}
	return items;
}

export interface CommandPaletteProps {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	/** Every app command with its feature's title (the registry's `paletteCommands`). */
	commands: readonly PaletteCommand[];
	platform: ShortcutPlatform;
	/** The palette's own command, left out of its list. */
	exclude?: string;
}

/** Runs a command from the palette; a failure is logged as a shortcut's is (useAppShortcuts). */
function runFromPalette(id: string): void {
	try {
		runCommand(id).catch((error: unknown) => {
			console.error(`[studio] command ${id} failed: ${describe(error)}`);
		});
	} catch (error) {
		console.error(`[studio] command ${id} failed: ${describe(error)}`);
	}
}

function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function CommandPalette({
	isOpen,
	onOpenChange,
	commands,
	platform,
	exclude,
}: CommandPaletteProps) {
	return (
		<CommandPaletteView
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			items={paletteItems(commands, platform, exclude)}
			onRun={runFromPalette}
		/>
	);
}
