// useAboutDemoJob: starts `about.demoJob` jobs. `start` answers the job's id at once; its states arrive as events,
// read with `useJob(jobId)` (shared/jobs/jobStore.ts).
import { type StartJob, useStartJob } from "../../../shared/jobs/jobStore";

/** About: demo job. */
export function useAboutDemoJob(): StartJob<"about.demoJob"> {
	return useStartJob("about.demoJob");
}
