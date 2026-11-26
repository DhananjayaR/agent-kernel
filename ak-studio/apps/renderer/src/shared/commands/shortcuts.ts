// Shortcuts (conventions-and-skills.md, Behaviour rules: declared in manifests, shown in menus and the palette, a
// clash fails a test). A manifest writes a shortcut once, platform-free: `Mod+J`, `Mod+Shift+P`, `Alt+F6`. `Mod` is
// Cmd on macOS and Ctrl elsewhere (P1b-plan ruling 13); `Ctrl` is Ctrl everywhere. Each platform resolves it to the
// aria-keyshortcuts form ("Meta+J", "Control+J"), which is also how a key press is named (eventShortcut), so the
// app's one keydown listener looks a press up in a map instead of testing every command. Mod+K is kept for the
// command palette (Task 16 declares it).
import type { Platform } from "@ak-studio/contract";

/** How shortcuts resolve: macOS (Mod is Cmd) or anything else (Mod is Ctrl). */
export type ShortcutPlatform = "mac" | "other";
export const SHORTCUT_PLATFORMS: readonly ShortcutPlatform[] = ["mac", "other"];

/** Shortcuts no command may take but the one named: Mod+K opens the command palette (Task 16). */
export const RESERVED_SHORTCUTS: Readonly<Record<string, string>> =
	Object.freeze({ "Mod+K": "shell.openCommandPalette" });

export interface ParsedShortcut {
	mod: boolean;
	ctrl: boolean;
	alt: boolean;
	shift: boolean;
	/** An upper-case letter, a digit, a named key (`F6`, `Enter`, `ArrowUp`) or one punctuation character. */
	key: string;
}

const MODIFIERS = {
	Mod: "mod",
	Ctrl: "ctrl",
	Alt: "alt",
	Shift: "shift",
} as const;
const NAMED_KEYS = new Set([
	"Enter",
	"Escape",
	"Tab",
	"Backspace",
	"Delete",
	"Space",
	"Home",
	"End",
	"PageUp",
	"PageDown",
	"ArrowUp",
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	...Array.from({ length: 12 }, (_, i) => `F${i + 1}`),
]);
const PUNCTUATION = new Set([..."`-=[]\\;',./"]);

function keyName(raw: string): string | undefined {
	if (/^[a-z0-9]$/i.test(raw)) return raw.toUpperCase();
	if (PUNCTUATION.has(raw) || NAMED_KEYS.has(raw)) return raw;
	return undefined;
}

/** Reads a manifest shortcut; throws for one it cannot accept (a bug in the manifest). */
export function parseShortcut(shortcut: string): ParsedShortcut {
	const parts = shortcut === "" ? [] : shortcut.split("+");
	const parsed: ParsedShortcut = {
		mod: false,
		ctrl: false,
		alt: false,
		shift: false,
		key: "",
	};
	const fail = (why: string): never => {
		throw new Error(`shortcut ${JSON.stringify(shortcut)}: ${why}`);
	};
	if (parts.length === 0) fail("it is empty");
	parts.forEach((part, i) => {
		const last = i === parts.length - 1;
		if (!last) {
			if (!Object.hasOwn(MODIFIERS, part)) fail(`${part} is not a modifier`);
			const flag = MODIFIERS[part as keyof typeof MODIFIERS];
			if (parsed[flag]) fail(`${part} is repeated`);
			parsed[flag] = true;
			return;
		}
		const key = keyName(part);
		if (key === undefined) fail(`${JSON.stringify(part)} is not a key`);
		parsed.key = key as string;
	});
	if (parsed.mod && parsed.ctrl) fail("Mod already means Ctrl outside macOS");
	// Shift changes a punctuation key's character by layout (Shift+/ is ? on US keyboards), so the press could
	// never be named back to this shortcut.
	if (parsed.shift && PUNCTUATION.has(parsed.key))
		fail("Shift with a punctuation key cannot be matched on every layout");
	return parsed;
}

interface Resolved {
	control: boolean;
	alt: boolean;
	shift: boolean;
	meta: boolean;
	key: string;
}

function resolve(shortcut: string, platform: ShortcutPlatform): Resolved {
	const p = parseShortcut(shortcut);
	return {
		control: p.ctrl || (p.mod && platform === "other"),
		alt: p.alt,
		shift: p.shift,
		meta: p.mod && platform === "mac",
		key: p.key,
	};
}

/** The aria-keyshortcuts form, in one order: Control, Alt, Shift, Meta, then the key. */
function canonical(r: Resolved): string {
	return [
		r.control && "Control",
		r.alt && "Alt",
		r.shift && "Shift",
		r.meta && "Meta",
		r.key,
	]
		.filter(Boolean)
		.join("+");
}

/** The shortcut on `platform`, in aria-keyshortcuts form: `Mod+J` is "Meta+J" on macOS, "Control+J" elsewhere. */
export function resolveShortcut(
	shortcut: string,
	platform: ShortcutPlatform,
): string {
	return canonical(resolve(shortcut, platform));
}

/** The shortcut as shown in menus, tooltips and the palette: "⌘J" on macOS, "Ctrl+J" elsewhere. */
export function formatShortcut(
	shortcut: string,
	platform: ShortcutPlatform,
): string {
	const r = resolve(shortcut, platform);
	if (platform === "mac")
		return [
			r.control && "⌃",
			r.alt && "⌥",
			r.shift && "⇧",
			r.meta && "⌘",
			r.key,
		]
			.filter(Boolean)
			.join("");
	return [r.control && "Ctrl", r.alt && "Alt", r.shift && "Shift", r.key]
		.filter(Boolean)
		.join("+");
}

/** Both forms, for a control that shows its shortcut: `label` in its tooltip, `aria` in aria-keyshortcuts. */
export function describeShortcut(
	shortcut: string,
	platform: ShortcutPlatform,
): { label: string; aria: string } {
	return {
		label: formatShortcut(shortcut, platform),
		aria: resolveShortcut(shortcut, platform),
	};
}

export type ShortcutEvent = Pick<
	KeyboardEvent,
	"key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"
>;

/**
 * A key press named the way shortcuts resolve ("Control+J"), or undefined for a modifier alone or a key no
 * shortcut can name. The letter typed wins; the physical key (`code`) is read only when the press made no Latin
 * letter or digit (Option on macOS, a Cyrillic layout), so AZERTY's A stays A.
 */
export function eventShortcut(event: ShortcutEvent): string | undefined {
	let key = keyName(event.key === " " ? "Space" : event.key);
	if (key === undefined || (event.altKey && !/^[A-Z0-9]$/.test(key))) {
		const physical = /^(?:Key([A-Z])|Digit([0-9]))$/.exec(event.code ?? "");
		if (physical) key = physical[1] ?? physical[2];
	}
	if (key === undefined) return undefined;
	return canonical({
		control: event.ctrlKey,
		alt: event.altKey,
		shift: event.shiftKey,
		meta: event.metaKey,
		key,
	});
}

/** What the navigator says about the platform (the browser renderer, where app.info reports "browser"). */
export interface NavigatorPlatform {
	platform?: string;
	userAgentData?: { platform?: string };
}

/** The platform shortcuts resolve for: app.info's, or in the browser (and before it answers) the navigator's. */
export function shortcutPlatform(
	appPlatform: Platform | undefined,
	nav: NavigatorPlatform | undefined = typeof navigator === "undefined"
		? undefined
		: (navigator as NavigatorPlatform),
): ShortcutPlatform {
	if (appPlatform === "darwin") return "mac";
	if (appPlatform === "linux" || appPlatform === "win32") return "other";
	const reported = nav?.userAgentData?.platform || nav?.platform || "";
	return /mac|iphone|ipad/i.test(reported) ? "mac" : "other";
}

/** Two or more commands (or a command and a reservation) that resolve to one shortcut on a platform. */
export interface ShortcutClash {
	shortcut: string;
	ids: string[];
}

/**
 * The clashes among `commands`' shortcuts on `platform`, including any command taking a reserved shortcut that is
 * not its own. Empty means none: the registry test runs this for every platform.
 */
export function findShortcutClashes(
	commands: readonly { id: string; shortcut?: string }[],
	platform: ShortcutPlatform,
	reserved: Readonly<Record<string, string>> = RESERVED_SHORTCUTS,
): ShortcutClash[] {
	const byShortcut = new Map<string, string[]>();
	const add = (shortcut: string, id: string) => {
		const resolved = resolveShortcut(shortcut, platform);
		const ids = byShortcut.get(resolved) ?? [];
		if (!ids.includes(id)) ids.push(id);
		byShortcut.set(resolved, ids);
	};
	for (const [shortcut, owner] of Object.entries(reserved))
		add(shortcut, owner);
	for (const command of commands)
		if (command.shortcut !== undefined) add(command.shortcut, command.id);
	return [...byShortcut.entries()]
		.filter(([, ids]) => ids.length > 1)
		.map(([shortcut, ids]) => ({ shortcut, ids }));
}
