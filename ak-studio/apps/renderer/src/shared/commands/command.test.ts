// App commands with no DOM: defineCommand checks what a manifest declares, and runCommand looks a command up,
// parses its arguments and runs it. An unknown id or bad arguments is a development error: it throws in
// development and tests, and is only logged in production, so it never takes the shell down.
import type { CapabilityCatalog } from "@ak-studio/kernel-catalog";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { useCapabilityScope } from "../capability/capability";
import { defineCommand } from "./command";
import {
	CommandUnavailableError,
	getCommands,
	runCommand,
	setCommands,
} from "./runCommand";

/** Knows `deploy.azure` (since 0.12.0) and `framework.old` (until 0.11.0), by the version's minor. */
const catalog: CapabilityCatalog = {
	has: (id) => id === "deploy.azure" || id === "framework.old",
	get: (id) =>
		id === "deploy.azure"
			? { id, title: "Azure", since: "0.12.0" }
			: id === "framework.old"
				? { id, title: "Old", since: "0.1.0", until: "0.11.0" }
				: undefined,
	status: (id, version) => {
		const minor = Number(version.split(".")[1]);
		if (id === "deploy.azure")
			return minor >= 12 ? "available" : "needs-upgrade";
		return minor >= 11 ? "removed" : "available";
	},
};

const initialScope = useCapabilityScope.getState();

afterEach(() => {
	useCapabilityScope.setState(initialScope, true);
	setCommands([]);
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe("defineCommand", () => {
	it("keeps what the manifest declares", () => {
		const run = vi.fn();
		const when = () => true;
		const args = z.strictObject({ path: z.string() });
		const command = defineCommand({
			id: "code.revealFile",
			title: "Reveal the file",
			args,
			when,
			capability: "code.reveal",
			run,
		});
		expect(command).toMatchObject({
			id: "code.revealFile",
			title: "Reveal the file",
			args,
			when,
			capability: "code.reveal",
			run,
		});
		expect(Object.isFrozen(command)).toBe(true);
	});

	it("refuses an id that is not feature.camelCase, an empty title or a shortcut it cannot read", () => {
		const run = () => {};
		for (const id of [
			"toggle",
			"Shell.toggle",
			"shell.",
			"shell.Toggle",
			"shell toggle",
		])
			expect(() => defineCommand({ id, title: "T", run }), id).toThrow();
		expect(() =>
			defineCommand({ id: "shell.toggle", title: " ", run }),
		).toThrow();
		expect(() =>
			defineCommand({ id: "shell.toggle", title: "T", shortcut: "Mod+", run }),
		).toThrow();
	});

	it("refuses a shortcut on a command that needs arguments (a shortcut passes none)", () => {
		const run = () => {};
		expect(() =>
			defineCommand({
				id: "code.revealFile",
				title: "Reveal the file",
				args: z.strictObject({ path: z.string() }),
				shortcut: "Mod+Shift+R",
				run,
			}),
		).toThrow(/must accept no arguments/);
		expect(
			defineCommand({
				id: "code.revealCurrent",
				title: "Reveal the current file",
				args: z.strictObject({ path: z.string() }).optional(),
				shortcut: "Mod+Shift+R",
				run,
			}).shortcut,
		).toBe("Mod+Shift+R");
	});
});

describe("setCommands", () => {
	it("installs the command list runCommand reads, and refuses a repeated id", () => {
		const one = defineCommand({ id: "a.one", title: "One", run: () => {} });
		setCommands([one]);
		expect(getCommands()).toEqual([one]);
		expect(() => setCommands([one, one])).toThrow(/a\.one/);
	});
});

describe("runCommand", () => {
	it("parses the arguments with the command's schema and runs it with the parsed value", async () => {
		const run = vi.fn();
		setCommands([
			defineCommand({
				id: "code.revealFile",
				title: "Reveal the file",
				args: z.strictObject({ path: z.string(), line: z.number().default(1) }),
				run,
			}),
		]);
		await runCommand("code.revealFile", { path: "agents/triage.py" });
		expect(run).toHaveBeenCalledExactlyOnceWith({
			path: "agents/triage.py",
			line: 1,
		});
	});

	it("runs a command with no schema with no arguments", async () => {
		const run = vi.fn();
		setCommands([defineCommand({ id: "a.one", title: "One", run })]);
		await runCommand("a.one");
		expect(run).toHaveBeenCalledExactlyOnceWith(undefined);
	});

	it("waits for a command that runs asynchronously", async () => {
		let finished = false;
		setCommands([
			defineCommand({
				id: "a.slow",
				title: "Slow",
				run: async () => {
					await Promise.resolve();
					finished = true;
				},
			}),
		]);
		await runCommand("a.slow");
		expect(finished).toBe(true);
	});

	it("does not run a command whose `when` is false", async () => {
		const run = vi.fn();
		setCommands([
			defineCommand({ id: "a.one", title: "One", when: () => false, run }),
		]);
		await runCommand("a.one");
		expect(run).not.toHaveBeenCalled();
	});

	it("throws in development for an unknown id or bad arguments", () => {
		const run = vi.fn();
		setCommands([
			defineCommand({
				id: "code.revealFile",
				title: "Reveal the file",
				args: z.strictObject({ path: z.string() }),
				run,
			}),
		]);
		expect(() => runCommand("code.nope")).toThrow(
			"command code.nope is not an app command",
		);
		expect(() => runCommand("code.revealFile", { path: 3 })).toThrow(
			/command code\.revealFile was given bad arguments/,
		);
		expect(() => runCommand("code.revealFile")).toThrow(/bad arguments/);
		expect(run).not.toHaveBeenCalled();
	});

	it("only logs them in production, and the shell carries on", async () => {
		vi.stubEnv("PROD", true);
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const run = vi.fn();
		setCommands([
			defineCommand({
				id: "code.revealFile",
				title: "Reveal the file",
				args: z.strictObject({ path: z.string() }),
				run,
			}),
		]);
		await expect(runCommand("code.nope")).resolves.toBeUndefined();
		await expect(
			runCommand("code.revealFile", { path: 3 }),
		).resolves.toBeUndefined();
		expect(run).not.toHaveBeenCalled();
		expect(error).toHaveBeenCalledTimes(2);
		expect(error.mock.calls[0]?.[0]).toBe(
			"[studio] command code.nope is not an app command",
		);
	});

	it("passes a failure of the command itself to the caller", async () => {
		setCommands([
			defineCommand({
				id: "a.fails",
				title: "Fails",
				run: () => {
					throw new Error("disk full");
				},
			}),
		]);
		await expect(runCommand("a.fails")).rejects.toThrow("disk full");
	});

	it("refuses a command whose capability the project's OAK version lacks, with the version gate's reason", async () => {
		const run = vi.fn();
		setCommands([
			defineCommand({
				id: "deploy.toAzure",
				title: "Deploy to Azure",
				capability: "deploy.azure",
				run,
			}),
			defineCommand({
				id: "a.old",
				title: "Old",
				capability: "framework.old",
				run,
			}),
		]);
		useCapabilityScope.setState({ catalog, version: "0.11.2" });
		const refused = runCommand("deploy.toAzure");
		await expect(refused).rejects.toBeInstanceOf(CommandUnavailableError);
		await expect(refused).rejects.toThrow("Needs OAK 0.12.0");
		await expect(runCommand("a.old")).rejects.toThrow("Removed in OAK 0.11.0");
		expect(run).not.toHaveBeenCalled();
		useCapabilityScope.setState({ catalog, version: "0.12.0" });
		await runCommand("deploy.toAzure");
		expect(run).toHaveBeenCalledOnce();
	});

	it("gates nothing with no project version, and still hides a `when`-false command before gating it", async () => {
		const run = vi.fn();
		setCommands([
			defineCommand({
				id: "deploy.toAzure",
				title: "Deploy to Azure",
				capability: "deploy.azure",
				run,
			}),
			defineCommand({
				id: "deploy.hidden",
				title: "Hidden",
				capability: "deploy.azure",
				when: () => false,
				run,
			}),
		]);
		useCapabilityScope.setState({ catalog, version: undefined });
		await runCommand("deploy.toAzure");
		expect(run).toHaveBeenCalledOnce();
		useCapabilityScope.setState({ catalog, version: "0.10.0" });
		await expect(runCommand("deploy.hidden")).resolves.toBeUndefined();
	});
});
