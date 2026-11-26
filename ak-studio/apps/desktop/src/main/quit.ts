// The quit rule (P1b ruling 11; architecture.md, Jobs) and the unload prompt, as plain logic: index.ts wires the
// gate to Electron's `before-quit` and to closing the last window, and `confirmUnload` to `will-prevent-unload`,
// with native dialogs behind the injected `ask`. No Electron import, so both are tested without it.
//
// The rule: with nothing running, quit at once. Jobs that can be cancelled (and every queued job): ask, then
// cancel them. A started job that survives quit (`terraform apply`): ask with Wait as the default and a warned
// Quit anyway. Sessions alone are stopped without asking. Cancelling and stopping get 5 seconds in all; the app
// then quits whatever is left (logged), and a job left behind shows as interrupted on the next launch.
import type { Job, Session } from "@ak-studio/contract";
import type { Log, QuitPlan } from "@ak-studio/runtime";
import { dialogStrings } from "./strings";

/** How long quitting waits, in all, for jobs to cancel and sessions to stop. */
export const QUIT_WAIT_MS = 5000;

/** A native message box, as plain data: index.ts hands it to Electron's dialog. Answers are button indexes. */
export interface PromptDialog {
	type: "question" | "warning";
	message: string;
	detail: string;
	buttons: string[];
	/** The button Enter picks. */
	defaultId: number;
	/** The button Esc, or closing the dialog, picks. Never the one that loses work. */
	cancelId: number;
}

/** Starts a timer; the answer cancels it. */
export type SetTimer = (fn: () => void, ms: number) => () => void;

export interface QuitGateOptions {
	jobs: {
		quitPlan(): QuitPlan;
		cancelAll(jobs: readonly Pick<Job, "id">[]): Promise<void>;
	};
	sessions: { list(): Session[]; stopAll(): Promise<void> };
	/** Shows a dialog and answers the index of the button chosen. */
	ask(dialog: PromptDialog): Promise<number>;
	/** Quits for real (Electron's `app.quit()`), once the gate allows it; that quit passes `request()`. */
	quit(): void;
	log: Log;
	/** Defaults to setTimeout; tests use fake timers. */
	setTimer?: SetTimer;
}

const defaultSetTimer: SetTimer = (fn, ms) => {
	const timer = setTimeout(fn, ms);
	return () => clearTimeout(timer);
};

const liveSessions = (sessions: readonly Session[]) =>
	sessions.filter((s) => s.state !== "stopped" && s.state !== "failed");

export function cancelJobsDialog(plan: QuitPlan): PromptDialog {
	const s = dialogStrings.cancelJobs;
	return {
		type: "question",
		message: s.message(plan.toCancel.length),
		detail: s.detail(plan.toCancel.map((j) => j.title)),
		buttons: [s.confirm, s.keep],
		defaultId: 0,
		cancelId: 1,
	};
}

export function finishJobsDialog(plan: QuitPlan): PromptDialog {
	const s = dialogStrings.finishJobs;
	return {
		type: "warning",
		message: s.message(plan.blocking.length),
		detail: s.detail(
			plan.blocking.map((j) => j.title),
			plan.toCancel.length,
		),
		buttons: [s.wait, s.quitAnyway],
		defaultId: 0,
		cancelId: 0,
	};
}

/**
 * Decides whether the app may quit. `request()` is called for every quit attempt (`before-quit`, and closing the
 * last window on Linux and Windows): it answers true when the quit may go on now; false means the caller stops
 * it, and the gate asks, cancels and stops in the background, then calls `quit()` itself. A second attempt while
 * it is doing that does nothing more.
 */
export class QuitGate {
	readonly #jobs: QuitGateOptions["jobs"];
	readonly #sessions: QuitGateOptions["sessions"];
	readonly #ask: QuitGateOptions["ask"];
	readonly #quit: () => void;
	readonly #log: Log;
	readonly #setTimer: SetTimer;
	#state: "idle" | "busy" | "allowed" = "idle";

	constructor(options: QuitGateOptions) {
		this.#jobs = options.jobs;
		this.#sessions = options.sessions;
		this.#ask = options.ask;
		this.#quit = options.quit;
		this.#log = options.log;
		this.#setTimer = options.setTimer ?? defaultSetTimer;
	}

	/** Whether a quit has been allowed (and not aborted since). */
	get allowed(): boolean {
		return this.#state === "allowed";
	}

	/** A quit attempt: true lets it go on now; false means stop it (the gate quits later if it may). */
	request(): boolean {
		if (this.#state === "allowed") return true;
		if (this.#state === "busy") return false;
		const plan = this.#jobs.quitPlan();
		if (
			plan.toCancel.length === 0 &&
			plan.blocking.length === 0 &&
			liveSessions(this.#sessions.list()).length === 0
		) {
			this.#state = "allowed";
			return true;
		}
		this.#state = "busy";
		void this.#decide();
		return false;
	}

	/** A quit the gate allowed did not happen (a window chose to stay open): the next quit is decided afresh. */
	aborted(): void {
		if (this.#state === "allowed") this.#state = "idle";
	}

	async #decide(): Promise<void> {
		try {
			// Asked afresh after each answer: a job can start, or a queued one turn into one that must finish, while
			// a dialog is open, and it must not be cancelled without its own question.
			let cancelConfirmed = false;
			let overrideConfirmed = false;
			for (;;) {
				const plan = this.#jobs.quitPlan();
				if (plan.blocking.length > 0 && !overrideConfirmed) {
					const choice = await this.#ask(finishJobsDialog(plan));
					if (choice !== 1) return this.#stayOpen();
					overrideConfirmed = true;
					cancelConfirmed = true;
				} else if (plan.toCancel.length > 0 && !cancelConfirmed) {
					const choice = await this.#ask(cancelJobsDialog(plan));
					if (choice !== 0) return this.#stayOpen();
					cancelConfirmed = true;
				} else {
					break;
				}
			}
			await this.#shutDown();
		} catch (err) {
			this.#log(
				`the quit dialog failed, so the app stays open: ${describe(err)}`,
			);
			return this.#stayOpen();
		}
		this.#state = "allowed";
		this.#quit();
	}

	#stayOpen(): void {
		this.#state = "idle";
	}

	/** Cancels every job and stops every session, waiting QUIT_WAIT_MS at most; logs what was left. */
	async #shutDown(): Promise<void> {
		const plan = this.#jobs.quitPlan();
		// Each failure is logged as it happens; one failing does not cut the other's wait short.
		const settled = (what: string, run: () => Promise<void>) =>
			new Promise<void>((resolve) => resolve(run())).catch((err: unknown) => {
				this.#log(`${what} on quit failed: ${describe(err)}`);
			});
		const work = Promise.all([
			settled("cancelling jobs", () =>
				this.#jobs.cancelAll([...plan.toCancel, ...plan.blocking]),
			),
			settled("stopping sessions", () => this.#sessions.stopAll()),
		]).then(() => true);
		let cancelTimer = () => {};
		const timeout = new Promise<false>((resolve) => {
			cancelTimer = this.#setTimer(() => resolve(false), QUIT_WAIT_MS);
		});
		const finished = await Promise.race([work, timeout]);
		cancelTimer();
		if (!finished) {
			const left = this.#jobs.quitPlan();
			const jobs = [...left.toCancel, ...left.blocking].map((j) => j.title);
			const sessions = liveSessions(this.#sessions.list()).map((s) => s.kind);
			this.#log(
				`quitting before everything stopped (after ${QUIT_WAIT_MS / 1000} s): jobs [${jobs.join(", ")}], sessions [${sessions.join(", ")}]`,
			);
		}
	}
}

/**
 * The renderer's `beforeunload` asked to stay (unsaved changes; Electron's `will-prevent-unload`): asks whether to
 * leave anyway. Synchronous, because Electron allows the unload only from inside the event. True means leave.
 */
export function confirmUnload(ask: (dialog: PromptDialog) => number): boolean {
	const s = dialogStrings.unsaved;
	return (
		ask({
			type: "warning",
			message: s.message,
			detail: s.detail,
			buttons: [s.leave, s.stay],
			defaultId: 1,
			cancelId: 1,
		}) === 0
	);
}

function describe(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}
