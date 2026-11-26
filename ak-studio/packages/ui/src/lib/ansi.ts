// ANSI colour in streamed output, collapsed to the existing text tokens (P1b design gate, streaming list: "How ANSI
// colour maps to the tokens", option A, signed off 26 November 2026). Most tools print no colour (CommandRunner runs
// them without a terminal); for those that force it, red, yellow and green keep their meaning as the danger, warning
// and success text colours, dim and bright black become muted text, bold is kept, and every other colour (blue,
// cyan, magenta, white, 256-colour and true-colour codes, backgrounds) is plain text. Never the primary or the AI
// colour. The text itself still says "ERROR", so a state is never colour alone.
//
// A small parser, no dependency. Only SGR sequences (`ESC [ … m`) change the style; every other escape sequence
// (cursor moves, erase, OSC titles and links) and any other control character but a tab is stripped. A carriage
// return inside a line (a progress bar redrawing itself) keeps what was written after the last one, as a terminal
// shows it. Each line is parsed on its own: the style starts plain on every line (a stream's chunks are lines, and
// a view may start anywhere in a stream, so a colour never leaks from a line out of view).

/** The text tokens a streamed line can use. */
export type AnsiTone = "default" | "danger" | "warning" | "success" | "muted";

/** One run of text in one style. */
export interface AnsiSegment {
	text: string;
	tone: AnsiTone;
	bold: boolean;
}

/**
 * The one mapping table: each tone's text colour class. Only text and status text tokens: never primary, never the
 * AI colour (a test checks it).
 */
export const ANSI_TONE_CLASS: Readonly<Record<AnsiTone, string>> = {
	default: "text-text",
	danger: "text-text-status-danger",
	warning: "text-text-status-warning",
	success: "text-text-status-success",
	muted: "text-text-muted",
};

/** Bold text (SGR 1). JetBrains Mono is bundled at one weight, so the browser draws it bolder. */
export const ANSI_BOLD_CLASS = "font-bold";

/** The foreground colours that keep a meaning; any other 30–37, 90–97 is the default text colour. */
const FOREGROUND: Readonly<Record<number, AnsiTone>> = {
	31: "danger",
	91: "danger",
	33: "warning",
	93: "warning",
	32: "success",
	92: "success",
	90: "muted",
};

interface SgrState {
	colour: AnsiTone | undefined;
	dim: boolean;
	bold: boolean;
}

/** Applies one SGR sequence's parameters (`"1;31"`, `""` for a reset) to `state`. */
function applySgr(state: SgrState, params: string): void {
	const codes = params === "" ? [0] : params.split(";").map(Number);
	for (let i = 0; i < codes.length; i += 1) {
		const code = codes[i];
		if (code === undefined || Number.isNaN(code)) continue;
		if (code === 0) {
			state.colour = undefined;
			state.dim = false;
			state.bold = false;
		} else if (code === 1) state.bold = true;
		else if (code === 2) state.dim = true;
		else if (code === 22) {
			state.bold = false;
			state.dim = false;
		} else if (code === 39) state.colour = undefined;
		else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97))
			state.colour = FOREGROUND[code] ?? "default";
		else if (code === 38 || code === 48 || code === 58) {
			// Extended colour: 5;n (256 colours) or 2;r;g;b (true colour). Its parameters are consumed, so `38;5;1`
			// is not read as bold or `38;2;0;0;31` as red. A foreground one is the default text colour.
			const kind = codes[i + 1];
			i += kind === 5 ? 2 : kind === 2 ? 4 : 1;
			if (code === 38) state.colour = "default";
		}
		// Anything else (backgrounds 40–47, 100–107, 49; italic, underline, inverse, blink) is dropped.
	}
}

/**
 * CSI sequences (SGR among them), OSC sequences (titles, links), and other escapes: ESC, any intermediate bytes,
 * then a final byte (`ESC ( B`, the character set `tput sgr0` selects; `ESC 7`; `ESC M`).
 */
const ESCAPE =
	// biome-ignore lint/suspicious/noControlCharactersInRegex: matching terminal escape sequences is the point.
	/\x1b\[([0-?]*)([ -/]*)([@-~])|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?|\x1b[ -/]*[0-~]?/g;

/** Control characters other than a tab (and ESC, handled above). */
// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is the point.
const CONTROL = /[\x00-\x08\x0a-\x1a\x1c-\x1f\x7f]/g;

function toneOf(state: SgrState): AnsiTone {
	return state.colour ?? (state.dim ? "muted" : "default");
}

/** One line of output as styled runs, in order; empty runs are left out. */
export function parseAnsiLine(line: string): AnsiSegment[] {
	// A carriage return redraws the line: keep what was written after the last one (a trailing one changes nothing).
	const trimmed = line.endsWith("\r") ? line.slice(0, -1) : line;
	const lastReturn = trimmed.lastIndexOf("\r");
	const text = lastReturn >= 0 ? trimmed.slice(lastReturn + 1) : trimmed;

	const segments: AnsiSegment[] = [];
	const state: SgrState = { colour: undefined, dim: false, bold: false };
	const push = (raw: string) => {
		const clean = raw.replace(CONTROL, "");
		if (clean === "") return;
		const tone = toneOf(state);
		const last = segments[segments.length - 1];
		if (last && last.tone === tone && last.bold === state.bold)
			last.text += clean;
		else segments.push({ text: clean, tone, bold: state.bold });
	};
	let at = 0;
	for (const match of text.matchAll(ESCAPE)) {
		push(text.slice(at, match.index));
		at = match.index + match[0].length;
		// Only an SGR sequence (final byte "m", no intermediate bytes) changes the style.
		if (match[3] === "m" && match[2] === "") applySgr(state, match[1] ?? "");
	}
	push(text.slice(at));
	return segments;
}

/** The line's text with every escape sequence and control character removed: what Copy copies. */
export function stripAnsi(line: string): string {
	return parseAnsiLine(line)
		.map((segment) => segment.text)
		.join("");
}
