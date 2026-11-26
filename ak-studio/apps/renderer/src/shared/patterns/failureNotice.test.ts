// The failure notice: what a failed command's notice says (a version-gated refusal names the command and the gate's
// reason; any other failure the catalogue's title and the error's message), that a bound notice receives it and an
// unbound one only logs, and that runReported reports both a rejection and a synchronous throw.

import { studioError } from "@ak-studio/contract";
import type { CapabilityCatalog } from "@ak-studio/kernel-catalog";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudioFailure } from "../bridge/client";
import { useCapabilityScope } from "../capability/capability";
import { defineCommand } from "../commands/command";
import { getCommands, setCommands } from "../commands/runCommand";
import {
	bindCommandFailureReporter,
	runReported,
} from "../commands/runReported";
import { errorStrings } from "../errors/strings";
import {
	bindFailureNotice,
	commandFailureNotice,
	reportCommandFailure,
} from "./failureNotice";

const appCommands = getCommands();
// As the Shell does: failures of commands run with runReported go to the notice.
let unbindReporter = () => {};
beforeEach(() => {
	unbindReporter = bindCommandFailureReporter(reportCommandFailure);
});
const initialScope = useCapabilityScope.getState();
afterEach(() => {
	unbindReporter();
	setCommands(appCommands);
	useCapabilityScope.setState(initialScope, true);
	vi.restoreAllMocks();
});

const catalog: CapabilityCatalog = {
	has: (id) => id === "deploy.azure",
	get: (id) =>
		id === "deploy.azure" ? { id, title: "Azure", since: "0.12.0" } : undefined,
	status: () => "needs-upgrade",
};

describe("commandFailureNotice", () => {
	it("says a version-gated command is not available, with the version gate's reason", async () => {
		const run = vi.fn();
		setCommands([
			defineCommand({
				id: "deploy.toAzure",
				title: "Deploy to Azure",
				capability: "deploy.azure",
				run,
			}),
		]);
		useCapabilityScope.setState({ catalog, version: "0.11.0" });
		const notify = vi.fn();
		const unbind = bindFailureNotice(notify);
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		runReported("deploy.toAzure");
		await vi.waitFor(() =>
			expect(notify).toHaveBeenCalledWith({
				title: "Deploy to Azure is not available",
				description: "Needs OAK 0.12.0",
			}),
		);
		expect(run).not.toHaveBeenCalled();
		expect(log).toHaveBeenCalledWith(
			"[studio] command deploy.toAzure failed: Needs OAK 0.12.0",
		);
		unbind();
	});

	it("says what happened (the catalogue's title) and what to do (the error's message) for a failure", () => {
		expect(
			commandFailureNotice(
				"about.runDemoJob",
				new StudioFailure(
					studioError("bridge.unavailable", "Restart the app."),
				),
			),
		).toEqual({
			title: errorStrings.titles.unavailable,
			description: "Restart the app.",
		});
		// Something that is not a StudioFailure (a bug) is the unexpected error.
		expect(commandFailureNotice("a.b", new Error("boom")).title).toBe(
			errorStrings.titles.internal,
		);
	});

	it("gives the toast the error's next action when it has one, which runs its app command", async () => {
		const run = vi.fn();
		setCommands([
			defineCommand({ id: "shell.openSettings", title: "Settings", run }),
		]);
		const notice = commandFailureNotice(
			"about.runDemoJob",
			new StudioFailure({
				...studioError("bridge.unavailable", "Restart the app."),
				action: { label: "Open settings", commandId: "shell.openSettings" },
			}),
		);
		expect(notice).toMatchObject({
			title: errorStrings.titles.unavailable,
			description: "Restart the app.",
			action: { label: "Open settings" },
		});
		notice.action?.onAction();
		await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
	});
});

describe("reporting", () => {
	it("reports a rejection and a synchronous throw; unbound, it only logs", async () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		setCommands([
			defineCommand({
				id: "a.rejects",
				title: "Rejects",
				run: () => Promise.reject(new Error("disk full")),
			}),
		]);
		const notify = vi.fn();
		const unbind = bindFailureNotice(notify);
		runReported("a.rejects");
		await vi.waitFor(() => expect(notify).toHaveBeenCalledOnce());
		// An unknown id throws synchronously in development: still reported.
		runReported("a.unknown");
		expect(notify).toHaveBeenCalledTimes(2);
		unbind();
		reportCommandFailure("a.rejects", new Error("again"));
		expect(notify).toHaveBeenCalledTimes(2);
		expect(log).toHaveBeenLastCalledWith(
			"[studio] command a.rejects failed: again",
		);
	});
});

describe("runReported with no reporter bound", () => {
	it("only logs", async () => {
		unbindReporter();
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		setCommands([
			defineCommand({
				id: "a.rejects",
				title: "Rejects",
				run: () => Promise.reject(new Error("disk full")),
			}),
		]);
		runReported("a.rejects");
		await vi.waitFor(() =>
			expect(log).toHaveBeenCalledWith(
				"[studio] command a.rejects failed: disk full",
			),
		);
	});
});
