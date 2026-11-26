// The quit rule (P1b ruling 11) and the unload prompt, without Electron: fake job and session services, a
// scripted `ask`, and fake timers for the 5-second bound. Nothing sleeps.
import type { Job, Session } from "@ak-studio/contract";
import type { Log, QuitPlan } from "@ak-studio/runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	confirmUnload,
	type PromptDialog,
	QUIT_WAIT_MS,
	QuitGate,
	type QuitGateOptions,
} from "./quit";

const job = (id: string, title: string, extra: Partial<Job> = {}): Job => ({
	id,
	kind: "t.demo",
	title,
	state: "running",
	commandIds: [],
	cancellable: true,
	survivesQuit: false,
	...extra,
});
const session = (id: string, state: Session["state"]): Session => ({
	id,
	kind: "run.server",
	state,
	commandIds: [],
});

interface Deferred<T> {
	promise: Promise<T>;
	resolve: (value: T) => void;
}
function deferred<T = void>(): Deferred<T> {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

/** A fake world: the plan and sessions the test sets, cancelAll and stopAll that the test finishes. */
function setup() {
	const world = {
		plan: { toCancel: [], blocking: [] } as QuitPlan,
		sessions: [] as Session[],
	};
	const cancelled = deferred();
	const stopped = deferred();
	const jobs = {
		quitPlan: vi.fn(() => structuredClone(world.plan)),
		// As JobService: nothing to cancel resolves at once.
		cancelAll: vi.fn((jobs: readonly Pick<Job, "id">[]) =>
			jobs.length === 0 ? Promise.resolve() : cancelled.promise,
		),
	};
	const sessions = {
		list: vi.fn(() => structuredClone(world.sessions)),
		stopAll: vi.fn(() => stopped.promise),
	};
	const answers: Array<Deferred<number>> = [];
	const asked: PromptDialog[] = [];
	const ask = vi.fn((dialog: PromptDialog) => {
		asked.push(dialog);
		const answer = deferred<number>();
		answers.push(answer);
		return answer.promise;
	});
	const quit = vi.fn();
	const log = vi.fn<Log>();
	const options: QuitGateOptions = { jobs, sessions, ask, quit, log };
	const gate = new QuitGate(options);
	/** Answers the newest dialog with the button labelled `label`. */
	const answer = async (label: string) => {
		const dialog = asked.at(-1) as PromptDialog;
		const index = dialog.buttons.indexOf(label);
		expect(index, `no "${label}" button`).not.toBe(-1);
		answers.at(-1)?.resolve(index);
		await vi.advanceTimersByTimeAsync(0);
	};
	return {
		world,
		jobs,
		sessions,
		ask,
		asked,
		answer,
		quit,
		log,
		gate,
		cancelled,
		stopped,
	};
}

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
});

describe("QuitGate: nothing running", () => {
	it("lets the quit go on at once, without asking or waiting", () => {
		const s = setup();
		s.world.sessions = [session("s1", "stopped"), session("s2", "failed")];
		expect(s.gate.request()).toBe(true);
		expect(s.gate.allowed).toBe(true);
		expect(s.ask).not.toHaveBeenCalled();
		expect(s.jobs.cancelAll).not.toHaveBeenCalled();
		expect(s.sessions.stopAll).not.toHaveBeenCalled();
		// Electron calls before-quit again for each step of the same quit: still allowed.
		expect(s.gate.request()).toBe(true);
		expect(s.quit).not.toHaveBeenCalled();
	});

	it("asks again on the next quit once a quit it allowed did not happen", async () => {
		const s = setup();
		expect(s.gate.request()).toBe(true);
		s.gate.aborted();
		expect(s.gate.allowed).toBe(false);
		s.world.plan.toCancel = [job("j1", "Create project")];
		expect(s.gate.request()).toBe(false);
		await flush();
		expect(s.ask).toHaveBeenCalledTimes(1);
	});
});

describe("QuitGate: jobs to cancel", () => {
	it("asks to cancel them, naming each, and on yes cancels the jobs and stops the sessions, then quits", async () => {
		const s = setup();
		const create = job("j1", "Create project");
		const queued = job("j2", "Validate agent", { state: "queued" });
		s.world.plan.toCancel = [create, queued];
		s.world.sessions = [session("s1", "running")];
		expect(s.gate.request()).toBe(false);
		await flush();
		expect(s.asked).toEqual([
			{
				type: "question",
				message: "Quit and cancel 2 jobs?",
				detail:
					"These jobs will be cancelled:\n• Create project\n• Validate agent",
				buttons: ["Cancel jobs and quit", "Keep working"],
				defaultId: 0,
				cancelId: 1,
			},
		]);
		await s.answer("Cancel jobs and quit");
		expect(s.jobs.cancelAll).toHaveBeenCalledWith([create, queued]);
		expect(s.sessions.stopAll).toHaveBeenCalledTimes(1);
		expect(s.quit).not.toHaveBeenCalled();
		s.cancelled.resolve();
		await flush();
		expect(s.quit).not.toHaveBeenCalled();
		s.stopped.resolve();
		await flush();
		expect(s.quit).toHaveBeenCalledTimes(1);
		expect(s.gate.allowed).toBe(true);
		expect(s.gate.request()).toBe(true);
		expect(s.log).not.toHaveBeenCalled();
	});

	it("says job, not jobs, for one", async () => {
		const s = setup();
		s.world.plan.toCancel = [job("j1", "Create project")];
		s.gate.request();
		await flush();
		expect(s.asked[0]).toMatchObject({
			message: "Quit and cancel 1 job?",
			detail: "These jobs will be cancelled:\n• Create project",
		});
	});

	it("keeps working on no: nothing is cancelled, the app stays open, and the next quit asks again", async () => {
		const s = setup();
		s.world.plan.toCancel = [job("j1", "Create project")];
		s.world.sessions = [session("s1", "running")];
		s.gate.request();
		await flush();
		await s.answer("Keep working");
		expect(s.jobs.cancelAll).not.toHaveBeenCalled();
		expect(s.sessions.stopAll).not.toHaveBeenCalled();
		expect(s.quit).not.toHaveBeenCalled();
		expect(s.gate.allowed).toBe(false);
		await vi.advanceTimersByTimeAsync(QUIT_WAIT_MS * 2);
		expect(s.ask).toHaveBeenCalledTimes(1);
		expect(s.gate.request()).toBe(false);
		await flush();
		expect(s.ask).toHaveBeenCalledTimes(2);
	});

	it("quits after 5 seconds even if a job or session has not finished, and logs what was left", async () => {
		const s = setup();
		s.world.plan.toCancel = [job("j1", "Create project")];
		s.world.sessions = [session("s1", "running")];
		s.gate.request();
		await flush();
		await s.answer("Cancel jobs and quit");
		s.cancelled.resolve();
		await vi.advanceTimersByTimeAsync(QUIT_WAIT_MS - 1);
		expect(s.quit).not.toHaveBeenCalled();
		// The session never stops; the job's runner never settled either.
		s.world.sessions = [session("s1", "stopping")];
		await vi.advanceTimersByTimeAsync(1);
		expect(s.quit).toHaveBeenCalledTimes(1);
		expect(s.log).toHaveBeenCalledTimes(1);
		expect(s.log.mock.calls[0]?.[0]).toMatch(
			/quitting before everything stopped.*Create project.*run\.server/,
		);
	});

	it("logs a failed cancel and still waits for the sessions to stop, then quits", async () => {
		const s = setup();
		s.world.plan.toCancel = [job("j1", "Create project")];
		s.world.sessions = [session("s1", "running")];
		s.jobs.cancelAll.mockRejectedValueOnce(new Error("cancel boom"));
		s.gate.request();
		await flush();
		await s.answer("Cancel jobs and quit");
		expect(s.log).toHaveBeenCalledWith(expect.stringContaining("cancel boom"));
		expect(s.quit).not.toHaveBeenCalled();
		s.stopped.resolve();
		await flush();
		expect(s.quit).toHaveBeenCalledTimes(1);
	});

	it("logs a failed stop and still bounds the wait for the jobs at 5 seconds, logging what was left", async () => {
		const s = setup();
		s.world.plan.toCancel = [job("j1", "Create project")];
		s.sessions.stopAll.mockRejectedValueOnce(new Error("stop boom"));
		s.gate.request();
		await flush();
		await s.answer("Cancel jobs and quit");
		expect(s.log).toHaveBeenCalledWith(expect.stringContaining("stop boom"));
		await vi.advanceTimersByTimeAsync(QUIT_WAIT_MS - 1);
		expect(s.quit).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(s.quit).toHaveBeenCalledTimes(1);
		expect(s.log).toHaveBeenLastCalledWith(
			expect.stringMatching(
				/quitting before everything stopped.*Create project/,
			),
		);
	});

	it("asks about a job that must finish if one started while the dialog was open, before cancelling anything", async () => {
		const s = setup();
		const apply = job("j2", "Apply changes", { survivesQuit: true });
		s.world.plan.toCancel = [
			job("j1", "Create project"),
			{ ...apply, state: "queued" },
		];
		s.gate.request();
		await flush();
		s.world.plan = {
			toCancel: [job("j1", "Create project")],
			blocking: [apply],
		};
		await s.answer("Cancel jobs and quit");
		expect(s.jobs.cancelAll).not.toHaveBeenCalled();
		expect(s.asked[1]).toMatchObject({ buttons: ["Wait", "Quit anyway"] });
		await s.answer("Wait");
		expect(s.jobs.cancelAll).not.toHaveBeenCalled();
		expect(s.quit).not.toHaveBeenCalled();
	});
});

describe("QuitGate: a job that must finish", () => {
	it("asks with Wait as the default and a warned Quit anyway; Wait keeps the app open and does not ask again", async () => {
		const s = setup();
		s.world.plan.blocking = [
			job("j1", "Apply changes", { survivesQuit: true, cancellable: false }),
		];
		expect(s.gate.request()).toBe(false);
		await flush();
		expect(s.asked).toEqual([
			{
				type: "warning",
				message: "Wait for 1 job to finish before quitting?",
				detail:
					"Still running:\n• Apply changes\n\nQuit anyway stops it partway. That can damage what it was changing, such as a Terraform state file, and you may have to repair it by hand.",
				buttons: ["Wait", "Quit anyway"],
				defaultId: 0,
				cancelId: 0,
			},
		]);
		await s.answer("Wait");
		expect(s.jobs.cancelAll).not.toHaveBeenCalled();
		expect(s.quit).not.toHaveBeenCalled();
		expect(s.gate.allowed).toBe(false);
		// The job finishing does not bring the dialog back or quit by itself.
		s.world.plan.blocking = [];
		await vi.advanceTimersByTimeAsync(QUIT_WAIT_MS * 2);
		expect(s.ask).toHaveBeenCalledTimes(1);
		expect(s.quit).not.toHaveBeenCalled();
	});

	it("says how many others it cancels too, plural", async () => {
		const s = setup();
		s.world.plan.blocking = [
			job("j1", "Apply changes", { survivesQuit: true }),
			job("j2", "Destroy deployment", { survivesQuit: true }),
		];
		s.world.plan.toCancel = [job("j3", "Create project")];
		s.gate.request();
		await flush();
		expect(s.asked[0]).toMatchObject({
			message: "Wait for 2 jobs to finish before quitting?",
			detail:
				"Still running:\n• Apply changes\n• Destroy deployment\n\nQuit anyway stops them partway. That can damage what they were changing, such as a Terraform state file, and you may have to repair it by hand.\n\nQuitting also cancels 1 other job.",
		});
	});

	it("on Quit anyway cancels every job, those that must finish too, without asking again, and quits", async () => {
		const s = setup();
		const apply = job("j1", "Apply changes", { survivesQuit: true });
		const create = job("j2", "Create project");
		s.world.plan = { toCancel: [create], blocking: [apply] };
		s.gate.request();
		await flush();
		await s.answer("Quit anyway");
		expect(s.ask).toHaveBeenCalledTimes(1);
		expect(s.jobs.cancelAll).toHaveBeenCalledWith([create, apply]);
		s.cancelled.resolve();
		s.stopped.resolve();
		await flush();
		expect(s.quit).toHaveBeenCalledTimes(1);
	});
});

describe("QuitGate: sessions alone", () => {
	it("stops them without asking, then quits", async () => {
		const s = setup();
		s.world.sessions = [session("s1", "starting"), session("s2", "stopped")];
		expect(s.gate.request()).toBe(false);
		await flush();
		expect(s.ask).not.toHaveBeenCalled();
		expect(s.sessions.stopAll).toHaveBeenCalledTimes(1);
		expect(s.quit).not.toHaveBeenCalled();
		s.stopped.resolve();
		await flush();
		expect(s.quit).toHaveBeenCalledTimes(1);
	});

	it("quits after 5 seconds if a session does not stop", async () => {
		const s = setup();
		s.world.sessions = [session("s1", "running")];
		s.gate.request();
		await vi.advanceTimersByTimeAsync(QUIT_WAIT_MS);
		expect(s.quit).toHaveBeenCalledTimes(1);
		expect(s.log).toHaveBeenCalledTimes(1);
	});
});

describe("QuitGate: re-entrancy", () => {
	it("does nothing more for a second quit while the dialog is open", async () => {
		const s = setup();
		s.world.plan.toCancel = [job("j1", "Create project")];
		expect(s.gate.request()).toBe(false);
		await flush();
		expect(s.gate.request()).toBe(false);
		expect(s.gate.request()).toBe(false);
		await flush();
		expect(s.ask).toHaveBeenCalledTimes(1);
		expect(s.jobs.quitPlan).toHaveBeenCalledTimes(2);
	});

	it("does nothing more for a second quit while cancelling", async () => {
		const s = setup();
		s.world.plan.toCancel = [job("j1", "Create project")];
		s.gate.request();
		await flush();
		await s.answer("Cancel jobs and quit");
		expect(s.gate.request()).toBe(false);
		await flush();
		expect(s.ask).toHaveBeenCalledTimes(1);
		expect(s.jobs.cancelAll).toHaveBeenCalledTimes(1);
		expect(s.sessions.stopAll).toHaveBeenCalledTimes(1);
		s.cancelled.resolve();
		s.stopped.resolve();
		await flush();
		expect(s.quit).toHaveBeenCalledTimes(1);
	});

	it("stays open and logs when the dialog fails, and asks again next time", async () => {
		const s = setup();
		s.world.plan.toCancel = [job("j1", "Create project")];
		s.ask.mockRejectedValueOnce(new Error("no display"));
		s.gate.request();
		await flush();
		expect(s.quit).not.toHaveBeenCalled();
		expect(s.log).toHaveBeenCalledWith(expect.stringContaining("no display"));
		expect(s.gate.request()).toBe(false);
		await flush();
		expect(s.ask).toHaveBeenCalledTimes(2);
	});
});

describe("confirmUnload", () => {
	it("asks Leave without saving? with Stay as the default, and answers whether to leave", () => {
		const asked: PromptDialog[] = [];
		expect(
			confirmUnload((dialog) => {
				asked.push(dialog);
				return dialog.buttons.indexOf("Leave");
			}),
		).toBe(true);
		expect(asked).toEqual([
			{
				type: "warning",
				message: "Leave without saving?",
				detail: "You have unsaved changes.",
				buttons: ["Leave", "Stay"],
				defaultId: 1,
				cancelId: 1,
			},
		]);
		expect(confirmUnload((dialog) => dialog.buttons.indexOf("Stay"))).toBe(
			false,
		);
		// Closed with Esc or the window manager: the cancel button.
		expect(confirmUnload((dialog) => dialog.cancelId)).toBe(false);
	});
});
