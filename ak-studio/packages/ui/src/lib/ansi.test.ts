// The ANSI colour mapping of the streaming list (P1b design gate, option A): the meaningful colours collapse to the
// status text tokens, the rest to plain text, unknown sequences are stripped, extended colours consume their
// parameters, and the mapping table uses only text tokens (never primary or the AI colour).
import { describe, expect, it } from "vitest";
import {
	ANSI_BOLD_CLASS,
	ANSI_TONE_CLASS,
	parseAnsiLine,
	stripAnsi,
} from "./ansi";

const ESC = "\x1b";

describe("parseAnsiLine", () => {
	it("leaves a line with no escapes as one plain run", () => {
		expect(parseAnsiLine("Step 1 of 3: Checking the app")).toEqual([
			{ text: "Step 1 of 3: Checking the app", tone: "default", bold: false },
		]);
		expect(parseAnsiLine("")).toEqual([]);
	});

	it("maps red, yellow and green (normal and bright) to danger, warning and success, and resets", () => {
		expect(
			parseAnsiLine(
				`${ESC}[31mERROR${ESC}[0m a ${ESC}[93mWARN${ESC}[39m b ${ESC}[32mok${ESC}[m.`,
			),
		).toEqual([
			{ text: "ERROR", tone: "danger", bold: false },
			{ text: " a ", tone: "default", bold: false },
			{ text: "WARN", tone: "warning", bold: false },
			{ text: " b ", tone: "default", bold: false },
			{ text: "ok", tone: "success", bold: false },
			{ text: ".", tone: "default", bold: false },
		]);
		expect(parseAnsiLine(`${ESC}[91mx`)[0]?.tone).toBe("danger");
		expect(parseAnsiLine(`${ESC}[92mx`)[0]?.tone).toBe("success");
	});

	it("keeps bold, maps dim and bright black to muted, and ends both with 22 or 0", () => {
		expect(
			parseAnsiLine(`${ESC}[1;31mFAILED${ESC}[22m tail ${ESC}[2mdim${ESC}[0m`),
		).toEqual([
			{ text: "FAILED", tone: "danger", bold: true },
			// Dim under a colour keeps the colour; runs in one style merge.
			{ text: " tail dim", tone: "danger", bold: false },
		]);
		expect(parseAnsiLine(`${ESC}[2mdim`)).toEqual([
			{ text: "dim", tone: "muted", bold: false },
		]);
		expect(parseAnsiLine(`${ESC}[90mgrey`)[0]?.tone).toBe("muted");
	});

	it("shows blue, cyan, magenta, white, black and backgrounds as plain text", () => {
		for (const code of [30, 34, 35, 36, 37, 94, 95, 96, 97])
			expect(parseAnsiLine(`${ESC}[${code}mx`), String(code)).toEqual([
				{ text: "x", tone: "default", bold: false },
			]);
		expect(parseAnsiLine(`${ESC}[41;44;101mx`)).toEqual([
			{ text: "x", tone: "default", bold: false },
		]);
	});

	it("consumes the parameters of 256-colour and true-colour codes", () => {
		// 38;5;1 is colour 1, not bold; 38;2;0;0;31 is a blue, not red.
		expect(parseAnsiLine(`${ESC}[38;5;1mx`)).toEqual([
			{ text: "x", tone: "default", bold: false },
		]);
		expect(parseAnsiLine(`${ESC}[38;2;0;0;31mx`)).toEqual([
			{ text: "x", tone: "default", bold: false },
		]);
		// A background one leaves the foreground alone; what follows is read again.
		expect(parseAnsiLine(`${ESC}[31;48;5;2;1mx`)).toEqual([
			{ text: "x", tone: "danger", bold: true },
		]);
		expect(parseAnsiLine(`${ESC}[31;48;2;1;2;3mx`)[0]?.bold).toBe(false);
	});

	it("strips other escape sequences and control characters, keeping tabs", () => {
		expect(
			stripAnsi(
				`${ESC}[2K${ESC}[1Gdone${ESC}]0;title\x07\tok${ESC}]8;;http://x${ESC}\\link\x07\x00`,
			),
		).toBe("done\toklink");
		expect(stripAnsi(`${ESC}[?25lhidden cursor${ESC}[?25h`)).toBe(
			"hidden cursor",
		);
	});

	it("keeps what follows the last carriage return, as a terminal shows a redrawn line", () => {
		expect(stripAnsi("10%\r50%\r100%")).toBe("100%");
		expect(stripAnsi("done\r")).toBe("done");
	});

	it("starts every line plain: a colour never carries over from the line before", () => {
		parseAnsiLine(`${ESC}[31mred with no reset`);
		expect(parseAnsiLine("next")[0]?.tone).toBe("default");
	});
});

describe("ANSI_TONE_CLASS", () => {
	it("uses only the text and status text tokens: never primary or the AI colour", () => {
		const allowed = new Set([
			"text-text",
			"text-text-muted",
			"text-text-status-danger",
			"text-text-status-warning",
			"text-text-status-success",
		]);
		for (const [tone, cls] of Object.entries(ANSI_TONE_CLASS)) {
			expect(allowed.has(cls), `${tone}: ${cls}`).toBe(true);
			expect(cls).not.toMatch(/primary|ai/);
		}
		expect(ANSI_BOLD_CLASS).toBe("font-bold");
	});
});
