// InterruptedJobs: the notice for jobs an earlier run left unfinished (architecture.md, Jobs: crash recovery; the
// spec's "killing the app mid-job shows the job as interrupted on the next launch"). The owning feature's screen
// mounts it with its job kinds (its manifest's `jobs`): one warning banner per interrupted job, in the view (the
// feedback placement rule: a banner for a view; a toast is for something that finished while the window watched,
// and this record must stay until the person has read it). Each says what happened and what to check, and
// "Dismiss" removes the record (`jobs.dismissInterrupted`), so it is not shown again. A dismiss that fails shows its
// error under the banners. A failed read of the list shows nothing: the notice is a courtesy, and the job's own view
// still works.
import { Button, ErrorBanner, fillString, InlineBanner } from "@ak-studio/ui";
import { useDismissInterrupted, useInterruptedJobs } from "../jobs/interrupted";
import { presentError } from "./presentError";
import { patternStrings } from "./strings";

export interface InterruptedJobsProps {
	/** The job kinds whose interrupted runs this view reports (its manifest's `jobs`). */
	kinds: readonly string[];
	className?: string;
}

export function InterruptedJobs({ kinds, className }: InterruptedJobsProps) {
	const { records, query } = useInterruptedJobs(kinds);
	const dismissal = useDismissInterrupted(() => query.refetch());
	if (records.length === 0 && !dismissal.error) return null;
	const text = patternStrings.interruptedJob;
	return (
		<div className={className} data-slot="interrupted-jobs">
			<div className="flex flex-col gap-2">
				{records.map((record) => (
					<InlineBanner
						key={record.jobId}
						tone="warning"
						title={fillString(text.title, { job: record.title })}
						actions={
							<Button
								onPress={() => dismissal.dismiss(record.jobId)}
								isPending={
									dismissal.showPending &&
									dismissal.variables?.jobId === record.jobId
								}
							>
								{text.dismiss}
							</Button>
						}
					>
						{text.description}
					</InlineBanner>
				))}
				{dismissal.error ? (
					<ErrorBanner error={presentError(dismissal.error.error)} />
				) : null}
			</div>
		</div>
	);
}
