// App commands (architecture.md, Features): the one way a feature offers an action to the rest of the app. A
// feature declares its commands in its manifest; any feature runs one with `runCommand(id, args)` (runCommand.ts),
// never by importing another feature. The same commands feed the command palette, menus, shortcuts and
// error actions. A command is checked when it is defined, so a bad manifest fails as the app loads (and in tests),
// not when someone presses a key.
import type { ZodType } from "zod";
import { parseShortcut } from "./shortcuts";

/** What a feature declares for one command. */
export interface CommandSpec<A = undefined> {
	/** `<feature>.<camelCaseVerb>`, unique across the app: `shell.toggleBottomPanel`, `code.revealFile`. */
	id: string;
	/** The command's name in the palette and menus, from the feature's strings module (sentence case). */
	title: string;
	/** The arguments' schema (a strict object); runCommand parses with it. Omitted, the command takes none. */
	args?: ZodType<A>;
	/** The shortcut, in manifest form: `Mod+J`, `Mod+Shift+P`, `F6` (shortcuts.ts). Mod is Cmd on macOS, Ctrl elsewhere. */
	shortcut?: string;
	/**
	 * The shortcut also acts while focus is in a text field. Off by default, so typing is never taken over; a
	 * command that produces no text and must work from anywhere (showing or hiding the bottom panel) opts in.
	 */
	whileTyping?: boolean;
	/** False hides the command (the palette leaves it out; its shortcut and runCommand do nothing). */
	when?: () => boolean;
	/**
	 * The kernel capability (catalog id) the command needs. When the project's OAK version lacks it, the palette
	 * lists the command with the version gate's reason rather than hiding it, and runCommand refuses it
	 * (commandGate in runCommand.ts).
	 */
	capability?: string;
	/** Runs the command with its parsed arguments. */
	run(args: A): void | Promise<void>;
}

/** A defined command, frozen. Lists hold `AppCommand` (any argument type: `run` is a method, so it is bivariant). */
export type AppCommand<A = unknown> = Readonly<CommandSpec<A>>;

const COMMAND_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.[a-z][a-zA-Z0-9]*$/;

/** Defines one app command; throws for an id, title or shortcut it cannot accept (a bug in the manifest). */
export function defineCommand<A = undefined>(
	spec: CommandSpec<A>,
): AppCommand<A> {
	if (!COMMAND_ID.test(spec.id))
		throw new Error(
			`command id ${JSON.stringify(spec.id)} is not <feature>.<camelCaseVerb>`,
		);
	if (spec.title.trim() === "")
		throw new Error(`command ${spec.id} has no title`);
	if (spec.shortcut !== undefined) {
		parseShortcut(spec.shortcut);
		// A shortcut runs the command with no arguments, so the schema must accept none.
		if (spec.args && !spec.args.safeParse(undefined).success)
			throw new Error(
				`command ${spec.id} has a shortcut, so it must accept no arguments`,
			);
	}
	return Object.freeze({ ...spec });
}
