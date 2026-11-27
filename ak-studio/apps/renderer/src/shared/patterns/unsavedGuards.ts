// The window's mounted unsaved-changes guards (UnsavedChangesGuard.tsx), so leaving with several unsaved views asks
// once, naming them all, and answers for all: Save saves every one, Discard drops every one only as the navigation
// goes on, Stay keeps every one. Without this each guard would hold its own blocker and the router would ask in turn,
// so a Discard on the first followed by a Stay on the second would drop work and stay.
//
// Each guard adds its entry while its copy is dirty (in the order they became dirty) and removes it when clean or
// unmounted, and says while its copy is saving (a save the view started: an explicit Save, an autosave, Keep mine),
// so the dialog does not offer Discard or Stay while a write that would undo them is on its way. One guard owns the
// router's blocker: the one already asking (`asking`), else the first entry.
import type { SaveOutcome } from "../working-copy/useWorkingCopy";

/** One dirty view, as the dialog names it and acts on it. */
export interface GuardEntry {
	readonly id: string;
	/** What is unsaved, as the dialog's title names it ("config.yaml"). */
	readonly what: string;
	readonly file: string | undefined;
	/** The Discard button's label when this view is the only one unsaved ("Discard session changes"). */
	readonly discardLabel: string | undefined;
	save(): Promise<SaveOutcome>;
	discard(): void;
}

export interface GuardsSnapshot {
	readonly entries: readonly GuardEntry[];
	/** A view's own save is running (its entry's write is on its way). */
	readonly saving: boolean;
	/** The guard whose dialog is open (its blocker is answering a navigation). */
	readonly asking: string | undefined;
}

class UnsavedGuards {
	#entries = new Map<string, GuardEntry>();
	#asking: string | undefined;
	#saving = new Set<string>();
	#snapshot: GuardsSnapshot = { entries: [], saving: false, asking: undefined };
	#listeners = new Set<() => void>();

	#changed(): void {
		this.#snapshot = {
			entries: [...this.#entries.values()],
			saving: this.#saving.size > 0,
			asking: this.#asking,
		};
		for (const listener of this.#listeners) listener();
	}

	/** Adds a dirty view; returns the removal. */
	add(entry: GuardEntry): () => void {
		this.#entries.set(entry.id, entry);
		this.#changed();
		return () => {
			if (this.#entries.get(entry.id) !== entry) return;
			this.#entries.delete(entry.id);
			this.#changed();
		};
	}

	/** Says whether `id`'s copy is saving. */
	setSaving(id: string, saving: boolean): void {
		if (this.#saving.has(id) === saving) return;
		if (saving) this.#saving.add(id);
		else this.#saving.delete(id);
		this.#changed();
	}

	/** Marks `id` as the guard asking (or no one). */
	setAsking(id: string | undefined): void {
		if (this.#asking === id) return;
		this.#asking = id;
		this.#changed();
	}

	subscribe = (listener: () => void): (() => void) => {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	};

	getSnapshot = (): GuardsSnapshot => this.#snapshot;
}

/** The window's guards (one window, one list). */
export const unsavedGuards = new UnsavedGuards();
