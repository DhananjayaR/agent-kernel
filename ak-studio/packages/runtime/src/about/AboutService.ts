// AboutService: serves the About feature's operations (architecture.md, Main-process services). It is browser-safe,
// like the rest of packages/runtime, so the desktop app and the browser's mock transport serve it alike (P1b-plan
// ruling 9); ../features.ts lists its factory. Its dependencies (the ports and the core services) come to the
// constructor. Each operation's handler is a method, and `register`, the last member, wires them; a job's runner is
// given to JobService there.
//
// About is the throwaway proving slice (P1b-plan Task 14): a query (the app's version and platform), a command with
// a revision (a note kept in memory, here and in the mock alike), a job with a request, and a session kind. Every
// wait goes through the injected clock, so tests run the one-second steps and ticks at once.
import {
	ERROR_CODES,
	type HandlerInputOf,
	type HandlerResultOf,
	type JobResultOf,
	type Operations,
	type Revision,
	type SessionInfoOf,
	StudioFailure,
} from "@ak-studio/contract";
import type { FeatureDeps, FeatureService } from "../features";
import type { JobContext } from "../jobs";
import type { RequestRegistrar } from "../registry";
import type { SessionContext, SessionHandle } from "../sessions";
import { aboutStrings } from "./strings";

/** How long each demo step and each tick takes. */
export const ABOUT_STEP_MS = 1000;

/** The revision of the empty note: the SHA-256 of "" (a test checks it against the digest). */
export const EMPTY_NOTE_REVISION: Revision =
	"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

/** A revision in the contract's format: the SHA-256 of the text, as 64 lowercase hex digits (Web Crypto). */
export async function noteRevision(text: string): Promise<Revision> {
	const bytes = new TextEncoder().encode(text);
	const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
	return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

export class AboutService implements FeatureService {
	readonly #deps: FeatureDeps;
	#note = "";
	#revision: Revision = EMPTY_NOTE_REVISION;

	constructor(deps: FeatureDeps) {
		this.#deps = deps;
	}

	/** Answers `about.info`. */
	info(): HandlerResultOf<Operations["about.info"]> {
		const { version, platform } = this.#deps.app;
		return { version, platform };
	}

	/** Answers `about.note`. */
	note(): HandlerResultOf<Operations["about.note"]> {
		return { note: this.#note, revision: this.#revision };
	}

	/** Answers `about.setNote`: writes the note if `baseRevision` is current, then tells the renderer it changed. */
	async setNote({
		note,
		baseRevision,
	}: HandlerInputOf<Operations["about.setNote"]>): Promise<
		HandlerResultOf<Operations["about.setNote"]>
	> {
		const revision = await noteRevision(note);
		// No await from here on: the check and the write are one step, so two writes on one base cannot both win.
		if (baseRevision !== this.#revision) {
			throw new StudioFailure({
				code: ERROR_CODES.fileChangedOnDisk,
				message: aboutStrings.noteChanged,
			});
		}
		this.#note = note;
		this.#revision = revision;
		this.#deps.events.emit({ type: "domain.changed", domain: "about" });
		return { revision };
	}

	/**
	 * Runs one `about.demoJob` job; its answer is the job's result. A step a second, with a line of output each, and
	 * a question before the last. Denying it cancels the job: the user stopped it, nothing failed.
	 */
	async demoJob(ctx: JobContext): Promise<JobResultOf<"about.demoJob">> {
		const { steps, stepLine, confirm } = aboutStrings;
		for (const [index, label] of steps.entries()) {
			const step = index + 1;
			if (step === steps.length) {
				const answer = await ctx.ask({
					kind: "confirm",
					title: confirm.title,
					summary: confirm.summary,
					affects: [],
					options: [
						{ id: "approve", label: confirm.approve },
						{ id: "deny", label: confirm.deny },
					],
				});
				if (answer.optionId === "deny") {
					// A runner ends its job as cancelled through its signal; cancelAll aborts it at once (not awaited:
					// it resolves only once this runner has returned).
					void this.#deps.jobs.cancelAll([{ id: ctx.jobId }]);
					return { steps: index };
				}
			}
			ctx.step(step, steps.length, label);
			ctx.stream.write("stdout", stepLine(step, steps.length, label));
			await this.#deps.clock.sleep(ABOUT_STEP_MS, ctx.signal);
		}
		return { steps: steps.length };
	}

	/** Starts an `about.ticker` session: `burst` lines at once if asked, then a line a second until stopped. */
	async startTicker(
		{ burst }: { burst?: number },
		ctx: SessionContext,
	): Promise<SessionHandle<SessionInfoOf<"about.ticker">>> {
		const { clock } = this.#deps;
		const stopped = new AbortController();
		if (burst !== undefined) {
			const lines = Array.from({ length: burst }, (_, i) =>
				aboutStrings.burstLine(i + 1, burst),
			);
			ctx.stream.write("stdout", lines.join("\n"));
		}
		void (async () => {
			for (let tick = 1; ; tick++) {
				try {
					await clock.sleep(ABOUT_STEP_MS, stopped.signal);
				} catch {
					return; // Stopped.
				}
				ctx.stream.write("stdout", aboutStrings.tickLine(tick));
			}
		})();
		return {
			info: { startedAt: clock.now() },
			stop: async () => stopped.abort(),
		};
	}

	register(registry: RequestRegistrar<Operations>): void {
		registry.handle("about.info", () => this.info());
		registry.handle("about.note", () => this.note());
		registry.handle("about.setNote", (input) => this.setNote(input));
		this.#deps.jobs.define("about.demoJob", (_input, ctx) => this.demoJob(ctx));
		registry.handle("about.demoJob", this.#deps.jobs.handler("about.demoJob"));
		this.#deps.sessions.define("about.ticker", (args, ctx) =>
			this.startTicker(args, ctx),
		);
	}
}
