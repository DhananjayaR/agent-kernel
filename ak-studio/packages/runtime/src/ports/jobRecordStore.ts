// The JobRecordStore port: a durable note of every running job, written when it starts and cleared when it
// ends, so a job the app was running when it quit or crashed shows as interrupted on the next start
// (`jobs.interrupted`). The desktop keeps one JSON file per job (NodeJobRecordStore, P1b Task 5); tests and
// the browser's mock use InMemoryJobRecordStore.
import type { InterruptedJob, JobId, JobState } from "@ak-studio/contract";

/** What is kept about a running job: exactly what `jobs.interrupted` shows if the app stops before it ends. */
export type JobRecord = InterruptedJob;

export interface JobRecordStore {
	/** Writes the record of a job that started, or replaces it (for example, with a new command id). */
	started(record: JobRecord): Promise<void>;
	/** The job ended in `state`: its record is no longer unfinished. */
	ended(jobId: JobId, state: JobState): Promise<void>;
	/** The records of jobs that started and never ended, oldest first. */
	unfinished(): Promise<JobRecord[]>;
	/** Removes an unfinished record (the user dismissed the notice). Answers whether there was one. */
	dismiss(jobId: JobId): Promise<boolean>;
}
