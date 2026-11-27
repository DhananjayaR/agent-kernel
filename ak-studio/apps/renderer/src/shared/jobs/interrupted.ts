// Interrupted jobs (architecture.md, Jobs: crash recovery): jobs from an earlier run whose start record has no end,
// because the app quit or crashed while they ran. `useInterruptedJobs` reads `jobs.interrupted` under the `jobs`
// domain's keys, keeping the records of the given kinds (the owning feature's, from its manifest's `jobs`), and
// `useDismissInterrupted` removes one record once the person has seen its notice (`jobs.dismissInterrupted`), then
// reads the list again. The notice itself is patterns/InterruptedJobs.tsx.
import type { InterruptedJob, JobId } from "@ak-studio/contract";
import {
	type StudioMutationResult,
	type StudioQueryResult,
	useStudioMutation,
	useStudioQuery,
} from "../query/hooks";
import { keys } from "../query/keys";

/** The `jobs` domain: app-level job data that is not in the job store (the store is fed by events). */
export const jobsKeys = keys("jobs");

/** `jobs.interrupted`'s key. */
export const interruptedJobsKey = jobsKeys.app("interrupted");

export interface InterruptedJobs {
	/** The interrupted jobs of the given kinds, in the order main lists them; empty until read. */
	records: readonly InterruptedJob[];
	query: StudioQueryResult<"jobs.interrupted">;
}

/** The interrupted jobs whose kind is one of `kinds`. */
export function useInterruptedJobs(kinds: readonly string[]): InterruptedJobs {
	const query = useStudioQuery(
		"jobs.interrupted",
		{},
		{ key: interruptedJobsKey },
	);
	const records = (query.data?.records ?? []).filter((record) =>
		kinds.includes(record.kind),
	);
	return { records, query };
}

/** Removes one interrupted job's record, then reads the list again. Fails only with a StudioFailure. */
export function useDismissInterrupted(
	refetch: () => unknown,
): StudioMutationResult<"jobs.dismissInterrupted"> & {
	dismiss(jobId: JobId): void;
} {
	const mutation = useStudioMutation("jobs.dismissInterrupted", {
		onSuccess: () => {
			refetch();
		},
	});
	return {
		...mutation,
		dismiss: (jobId) => mutation.mutate({ jobId }),
	};
}
