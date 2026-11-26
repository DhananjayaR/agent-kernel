// What is unsaved in this window, for the "nothing is lost silently" rule (conventions-and-skills.md, behaviour
// rules). Each guard (useUnsavedGuard) adds a label while its view is dirty. While anything is unsaved, the page's
// `beforeunload` is refused (Electron answers with its native prompt, P1b ruling 11), and main is kept told of the
// labels through `app.setUnsaved`, so the quit rule asks about them before it cancels any job. One registry for the
// window, so main gets one list, not one per view.
import { getTransport } from "../bridge/client";

/** How long a change to the list waits for the next before main is told (typing does not flood the bridge). */
export const UNSAVED_REPORT_DELAY_MS = 100;

export interface UnsavedWorkOptions {
	/** Tells main the whole list. */
	report: (items: string[]) => Promise<unknown>;
	/** The window whose unload is refused while anything is unsaved; none outside a browser. */
	target?: () =>
		| Pick<Window, "addEventListener" | "removeEventListener">
		| undefined;
	log?: (message: string) => void;
	delayMs?: number;
}

const refuseUnload = (event: BeforeUnloadEvent) => {
	event.preventDefault();
	// Older engines need a return value as well.
	event.returnValue = "";
};

export class UnsavedWork {
	readonly #entries = new Map<symbol, string>();
	readonly #report: UnsavedWorkOptions["report"];
	readonly #target: NonNullable<UnsavedWorkOptions["target"]>;
	readonly #log: (message: string) => void;
	readonly #delayMs: number;
	#listening: Pick<Window, "removeEventListener"> | undefined;
	#timer: ReturnType<typeof setTimeout> | undefined;
	/** What main was last told; it starts empty (main clears its list when the page loads). Unknown after a failure. */
	#reported: string[] | undefined = [];

	constructor(options: UnsavedWorkOptions) {
		this.#report = options.report;
		this.#target =
			options.target ??
			(() => (typeof window === "undefined" ? undefined : window));
		this.#log =
			options.log ?? ((message) => console.error(`[studio] ${message}`));
		this.#delayMs = options.delayMs ?? UNSAVED_REPORT_DELAY_MS;
	}

	/** Marks `label` as unsaved; the answer clears it. The same label from two views is listed once. */
	add(label: string): () => void {
		const id = Symbol(label);
		this.#entries.set(id, label);
		this.#changed();
		return () => {
			if (this.#entries.delete(id)) this.#changed();
		};
	}

	/** The unsaved labels, once each, in the order they became unsaved. */
	items(): string[] {
		return [...new Set(this.#entries.values())];
	}

	#changed(): void {
		const empty = this.#entries.size === 0;
		if (!empty && !this.#listening) {
			const target = this.#target();
			target?.addEventListener("beforeunload", refuseUnload);
			this.#listening = target;
		} else if (empty && this.#listening) {
			this.#listening.removeEventListener("beforeunload", refuseUnload);
			this.#listening = undefined;
		}
		if (this.#timer !== undefined) clearTimeout(this.#timer);
		this.#timer = undefined;
		// The last item clearing is told at once: a quit right after a save must not ask about it.
		if (empty) this.#send();
		else this.#timer = setTimeout(() => this.#send(), this.#delayMs);
	}

	#send(): void {
		this.#timer = undefined;
		const items = this.items();
		if (sameList(items, this.#reported)) return;
		this.#reported = items;
		this.#report(items).catch((err: unknown) => {
			// Unknown now: the next change sends its list whatever it is.
			if (this.#reported === items) this.#reported = undefined;
			this.#log(
				`app.setUnsaved failed: ${err instanceof Error ? err.message : String(err)}`,
			);
		});
	}
}

function sameList(
	a: readonly string[],
	b: readonly string[] | undefined,
): boolean {
	return (
		b !== undefined &&
		a.length === b.length &&
		a.every((item, i) => item === b[i])
	);
}

/** The window's registry: every guard adds to it, and it reports through the app's transport. */
export const unsavedWork = new UnsavedWork({
	report: (items) => getTransport().request("app.setUnsaved", { items }),
});
