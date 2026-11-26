// JobProgress: the job progress pattern over one job in the job store (architecture.md, Jobs; P1b design gate row
// (a)). The view that started the job shows it inline; several stack newest first (JobProgressList). It reads the
// job with `useJob` and fills JobProgressView: the title, the state, the current step, the elapsed time from the
// job's `startedAt` (the clock is ClockProvider's, so tests and stories freeze it), "Stop" when the job is
// cancellable (cancelJob, pending after 300 ms, a refusal said inline), the job's question as the approval pattern
// (Approval), and at the end the result (the view's own words for its typed result), "Stopped", or the error in the
// error family's banner (presentError, as ErrorView shows it: what happened, what to do, file and line, the detail
// collapsed, and its next action run through runReported).
//
// "Show commands" runs the app command `shell.showCommands` (it opens the bottom panel on the Commands view) and is
// shown only when the job ran commands (`commandIds`) and that command exists. The Commands view lists a job's
// commands from P2 (CommandRow, the recorded commands); until then it opens the view as it is. No P1b job runs a
// command, so the About slice never shows the link.
import type { Job, JobId, JobState } from "@ak-studio/contract";
import {
	JobProgressStack,
	type JobProgressState,
	JobProgressView,
} from "@ak-studio/ui";
import { type ReactNode, useState } from "react";
import { findCommand } from "../commands/runCommand";
import { runReported } from "../commands/runReported";
import { cancelJob, useJob } from "../jobs/jobStore";
import { usePendingAfter } from "../query/pending";
import { Approval } from "./Approval";
import { useNow } from "./clock";
import { type ErrorSlots, failureOf, presentError } from "./presentError";

/** The app command behind "Show commands" (the shell's; app/shell/manifest.ts). */
export const SHOW_COMMANDS_COMMAND = "shell.showCommands";

const VIEW_STATE: Record<JobState, JobProgressState> = {
	queued: "queued",
	running: "running",
	"waiting-for-user": "waiting",
	succeeded: "succeeded",
	failed: "failed",
	cancelled: "cancelled",
};

const ACTIVE: ReadonlySet<JobState> = new Set([
	"queued",
	"running",
	"waiting-for-user",
]);

export interface JobProgressProps {
	jobId: JobId;
	/** The result in one line, in the view's own words (a job's result is typed per kind). */
	renderResult?: (job: Job) => ReactNode;
	/** Why stopping this job is unsafe, shown beside "Stop". */
	stopCaution?: string;
}

export function JobProgress({
	jobId,
	renderResult,
	stopCaution,
}: JobProgressProps) {
	const job = useJob(jobId);
	const active = job !== undefined && ACTIVE.has(job.state);
	// Ticks only while a time can show: running or waiting, with a start time (not while queued).
	const now = useNow(active && job?.startedAt !== undefined);
	const [stopping, setStopping] = useState(false);
	const [stopError, setStopError] = useState<ErrorSlots>();
	const stopLate = usePendingAfter(stopping, jobId);
	if (!job) return null;

	const stop = () => {
		if (stopping) return;
		setStopping(true);
		setStopError(undefined);
		cancelJob(job.id)
			.catch((reason: unknown) => setStopError(presentError(failureOf(reason))))
			.finally(() => setStopping(false));
	};
	const showCommands =
		job.commandIds.length > 0 && findCommand(SHOW_COMMANDS_COMMAND)
			? () => {
					runReported(SHOW_COMMANDS_COMMAND);
				}
			: undefined;

	return (
		<JobProgressView
			title={job.title}
			state={VIEW_STATE[job.state]}
			step={job.progress}
			elapsedMs={job.startedAt === undefined ? undefined : now - job.startedAt}
			onStop={job.cancellable ? stop : undefined}
			stopPending={stopLate}
			stopCaution={stopCaution}
			stopError={stopError}
			onShowCommands={showCommands}
			result={job.state === "succeeded" ? renderResult?.(job) : undefined}
			error={job.error ? presentError(job.error) : undefined}
		>
			<Approval job={job} />
		</JobProgressView>
	);
}

export interface JobProgressListProps extends Omit<JobProgressProps, "jobId"> {
	/** The view's jobs, in the order they started; shown newest first. */
	jobIds: readonly JobId[];
}

/** Several jobs in one view, each its own block, newest first; nothing hidden. */
export function JobProgressList({ jobIds, ...props }: JobProgressListProps) {
	if (jobIds.length === 0) return null;
	return (
		<JobProgressStack>
			{[...jobIds].reverse().map((id) => (
				<JobProgress key={id} jobId={id} {...props} />
			))}
		</JobProgressStack>
	);
}
