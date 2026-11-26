// The renderer's job store (architecture.md, Jobs): every job the main process has announced, by id. It is filled
// by `job.updated` events and, after a reload or a reconnect, by `jobs.list` (events/reattach.ts). For each job
// it keeps the newest state by the job's `seq`, so a late list or an early event never rolls a job back. A view
// reads one job with `useJob`, which re-renders only when that job changes. Jobs are started with `useStartJob`
// and answered or cancelled with `respondToJob` and `cancelJob`; what they change comes back as events.
import type {
	InputOf,
	Job,
	JobId,
	JobKindName,
	OutputOf,
} from "@ak-studio/contract";
import { useMemo } from "react";
import { create } from "zustand";
import { requestStudio } from "../query/hooks";

export interface JobStoreState {
	readonly jobs: Readonly<Record<JobId, Job>>;
}

export const useJobStore = create<JobStoreState>()(() => ({ jobs: {} }));

/**
 * Puts each job in the store unless the store already has the same or a newer state of it (a `seq` at least as
 * high). One store update for the lot; none when nothing is newer.
 */
export function applyJobs(jobs: readonly Job[]): void {
	if (jobs.length === 0) return;
	useJobStore.setState((state) => {
		let next: Record<JobId, Job> | undefined;
		for (const job of jobs) {
			const known = (next ?? state.jobs)[job.id];
			if (known !== undefined && known.seq >= job.seq) continue;
			next ??= { ...state.jobs };
			next[job.id] = job;
		}
		return next ? { jobs: next } : state;
	});
}

/** One job, by id; re-renders only when that job changes. Undefined until the store has it. */
export function useJob(jobId: JobId | undefined): Job | undefined {
	return useJobStore((state) =>
		jobId === undefined ? undefined : state.jobs[jobId],
	);
}

export interface StartJob<N extends JobKindName> {
	/** Starts the job and answers its id at once; its states arrive as events (read them with `useJob`). */
	start(input: InputOf<N>): Promise<JobId>;
}

/** Starts jobs of the kind `name` (a job operation in the contract). Rejects only with a StudioFailure. */
export function useStartJob<N extends JobKindName>(name: N): StartJob<N> {
	return useMemo(
		() => ({
			async start(input: InputOf<N>): Promise<JobId> {
				// Every job operation answers `{ jobId }` (shapes.ts, `job()`); TypeScript cannot see that through N.
				const output = (await requestStudio(name, input)) as OutputOf<N> & {
					jobId: JobId;
				};
				return output.jobId;
			},
		}),
		[name],
	);
}

/** Answers a job's open request (`job.respond`). Rejects only with a StudioFailure. */
export async function respondToJob(
	input: InputOf<"job.respond">,
): Promise<void> {
	await requestStudio("job.respond", input);
}

/** Cancels a job (`job.cancel`); it ends in `cancelled`. Rejects only with a StudioFailure. */
export async function cancelJob(jobId: JobId): Promise<void> {
	await requestStudio("job.cancel", { jobId });
}
