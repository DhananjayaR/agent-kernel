// The About feature's store (architecture.md, "Where each kind of data lives"): its UI state, such as what is
// selected, and any working copy. Data from the main process stays in the query cache (api/), never here.
import { create } from "zustand";

export interface AboutState {
	/** The id of what is selected in the feature's screen, if anything. */
	selectedId: string | undefined;
	select(id: string | undefined): void;
}

export const useAboutStore = create<AboutState>()((set) => ({
	selectedId: undefined,
	select: (selectedId) => set({ selectedId }),
}));
