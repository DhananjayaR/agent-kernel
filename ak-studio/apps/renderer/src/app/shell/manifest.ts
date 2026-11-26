// The shell's manifest: the shell joins the registry like a feature (app/features.ts lists it first), with no tab
// and no route, only its app commands. shell.toggleBottomPanel takes Mod+J over from the bottom panel (P1b-plan
// ruling 13); it acts in text fields too (`whileTyping`), as Mod+J did in P1a, since it types nothing. Mod+K is
// kept for the command palette's shell.openCommandPalette (Task 16; shared/commands/shortcuts.ts). shell.showCommands
// opens the bottom panel on the Commands view: the job progress pattern's "Show commands" (Task 15).
// shell.openCommandPalette opens the command palette on Mod+K (Task 16), the id RESERVED_SHORTCUTS names; like Mod+J
// it acts in text fields too, since it types nothing. The palette does not list it (it is open already).
import { defineCommand } from "../../shared/commands/command";
import { defineFeature } from "../../shared/commands/feature";
import { shellActions, shellActionsBound } from "./shellActions";
import { shellStrings } from "./strings";

/** The bottom panel's show/hide command id (the Shell reads its shortcut through the registry). */
const TOGGLE_BOTTOM_PANEL = "shell.toggleBottomPanel";

/** The command palette's command id (shared/commands/shortcuts.ts reserves Mod+K for it). */
export const OPEN_COMMAND_PALETTE = "shell.openCommandPalette";

export const shellFeature = defineFeature({
	id: "shell",
	// Its commands act on the window's views: "View: Show or hide the panel" in the command palette.
	title: shellStrings.title,
	commands: [
		defineCommand({
			id: TOGGLE_BOTTOM_PANEL,
			title: shellStrings.commands.toggleBottomPanel,
			shortcut: "Mod+J",
			whileTyping: true,
			when: shellActionsBound,
			run: () => shellActions().toggleBottomPanel(),
		}),
		// The job progress pattern's "Show commands" (shared/patterns/JobProgress.tsx runs it by id).
		defineCommand({
			id: "shell.showCommands",
			title: shellStrings.commands.showCommands,
			when: shellActionsBound,
			run: () => shellActions().showCommands(),
		}),
		defineCommand({
			id: OPEN_COMMAND_PALETTE,
			title: shellStrings.commands.openCommandPalette,
			shortcut: "Mod+K",
			whileTyping: true,
			when: shellActionsBound,
			run: () => shellActions().openCommandPalette(),
		}),
	],
	capabilities: [],
});
