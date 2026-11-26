// The shell's manifest: the shell joins the registry like a feature (app/features.ts lists it first), with no tab
// and no route, only its app commands. shell.toggleBottomPanel takes Mod+J over from the bottom panel (P1b-plan
// ruling 13); it acts in text fields too (`whileTyping`), as Mod+J did in P1a, since it types nothing. Mod+K is
// kept for the command palette's shell.openCommandPalette (Task 16; shared/commands/shortcuts.ts).
import { defineCommand } from "../../shared/commands/command";
import { defineFeature } from "../../shared/commands/feature";
import { shellActions, shellActionsBound } from "./shellActions";
import { shellStrings } from "./strings";

/** The bottom panel's show/hide command id, which the Shell reads its shortcut from. */
export const TOGGLE_BOTTOM_PANEL = "shell.toggleBottomPanel";

export const shellFeature = defineFeature({
	id: "shell",
	commands: [
		defineCommand({
			id: TOGGLE_BOTTOM_PANEL,
			title: shellStrings.commands.toggleBottomPanel,
			shortcut: "Mod+J",
			whileTyping: true,
			when: shellActionsBound,
			run: () => shellActions().toggleBottomPanel(),
		}),
	],
	capabilities: [],
});
