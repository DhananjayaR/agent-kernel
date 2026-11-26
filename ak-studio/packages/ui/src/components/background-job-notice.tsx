// The background job notice (P1b design gate row (a), signed off 26 November 2026): a job finished, failed or needs
// an answer while the person is on another tab. Two parts, both presentational (the renderer's
// shared/patterns/BackgroundJobNotice decides when):
//
// - JobTabIcon: a state icon on the owning tab instead of a count (a Badge is "a count, never a state"). It is the
//   icon-only StatusChip: waiting, finished and failed each have their own icon (never colour alone) and an
//   accessible name read with the tab's label ("Deploy Needs your answer"). A waiting job's icon stays until the
//   question is answered; a finished or failed one goes when the person opens the tab.
// - backgroundJobNotice: the one toast template, filled from the job's title: "{Job} finished" (success), "{Job}
//   failed" (danger), "{Job} is waiting for you" (info), each with "Show", which takes the person to the job.
//   A toast with an action stays until dismissed. A job that waits is never only a toast: the tab icon and the
//   approval stay.
//
// No list of running jobs until P6 (design gate row (a), "Where a list of running jobs lives": C for now).
import { type BackgroundJobStrings, fillString, uiStrings } from "../strings";
import { StatusChip } from "./status-chip";
import type { BackgroundResult } from "./toast";

/** What a background job has come to: it needs an answer, it finished, or it failed. */
export type BackgroundJobEvent = "waiting" | "finished" | "failed";

const ICON = {
	waiting: { status: "waiting", label: "waitingIcon" },
	finished: { status: "passed", label: "finishedIcon" },
	failed: { status: "failed", label: "failedIcon" },
} as const;

export type JobTabIconProps = {
	event: BackgroundJobEvent;
	strings?: Partial<BackgroundJobStrings>;
	className?: string;
};

/** The owning tab's state icon (DesktopShell's `tabBadges` slot). */
export function JobTabIcon({ event, strings, className }: JobTabIconProps) {
	const text = { ...uiStrings.backgroundJob, ...strings };
	const { status, label } = ICON[event];
	return (
		<StatusChip
			iconOnly
			status={status}
			label={text[label]}
			data-job-event={event}
			className={className}
		/>
	);
}

const TONE = {
	waiting: "info",
	finished: "success",
	failed: "danger",
} as const;

export type BackgroundJobNoticeInput = {
	event: BackgroundJobEvent;
	/** The job's title, as the job has it ("Apply"). */
	jobTitle: string;
	/** One line: the result, what happened, or the question ("Apply this plan?"). */
	description?: string;
	/** Takes the person to the job (runs the owning feature's command). Without it, the toast has no "Show". */
	onShow?: () => void;
	strings?: Partial<BackgroundJobStrings>;
};

/** The toast for a background job (pass it to `notifyBackgroundResult`): the one template, in one strings module. */
export function backgroundJobNotice({
	event,
	jobTitle,
	description,
	onShow,
	strings,
}: BackgroundJobNoticeInput): BackgroundResult {
	const text = { ...uiStrings.backgroundJob, ...strings };
	return {
		tone: TONE[event],
		title: fillString(text[event], { job: jobTitle }),
		...(description ? { description } : {}),
		...(onShow ? { action: { label: text.show, onAction: onShow } } : {}),
	};
}
