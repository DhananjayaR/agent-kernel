// Running an app command by id: how features act on each other without importing each other (architecture.md,
// Features). The app registry (app/registry.ts) installs the command list from the manifests with setCommands;
// shared/ cannot import app/, so the list is handed down rather than read up. An unknown id or arguments the
// command's schema refuses is a development error: it throws in development and tests (the source scan and the
// manifest tests catch most first), and in production it is logged and nothing runs, so a stale id never takes
// the shell down.
import type { AppCommand } from "./command";

let commands: readonly AppCommand[] = [];
let byId: ReadonlyMap<string, AppCommand> = new Map();

/** Installs the app's commands (the registry does this once); throws for a repeated id. */
export function setCommands(list: readonly AppCommand[]): void {
	const next = new Map<string, AppCommand>();
	for (const command of list) {
		if (next.has(command.id))
			throw new Error(`command ${command.id} is declared twice`);
		next.set(command.id, command);
	}
	commands = [...list];
	byId = next;
}

/** Every app command, in manifest order: what the command palette lists (Task 16). */
export function getCommands(): readonly AppCommand[] {
	return commands;
}

/** The command with `id`, if there is one. */
export function findCommand(id: string): AppCommand | undefined {
	return byId.get(id);
}

/** A bug in the caller, not a failure of the command: thrown in development and tests, logged in production. */
function developmentError(message: string): Promise<void> {
	if (!import.meta.env.PROD) throw new Error(message);
	console.error(`[studio] ${message}`);
	return Promise.resolve();
}

/**
 * Looks the command up, parses `args` with its schema and runs it. Resolves when the command has run; rejects if
 * the command itself fails. A command whose `when` is false does not run. An unknown id or bad arguments throws
 * at once in development and tests, and only logs in production.
 */
export function runCommand(id: string, args?: unknown): Promise<void> {
	const command = byId.get(id);
	if (!command) return developmentError(`command ${id} is not an app command`);
	let parsed: unknown;
	if (command.args) {
		const result = command.args.safeParse(args);
		if (!result.success)
			return developmentError(
				`command ${id} was given bad arguments: ${result.error.message}`,
			);
		parsed = result.data;
	} else if (args !== undefined) {
		return developmentError(`command ${id} takes no arguments`);
	}
	if (command.when && !command.when()) return Promise.resolve();
	try {
		return Promise.resolve(command.run(parsed)).then(() => undefined);
	} catch (err) {
		return Promise.reject(err);
	}
}
