// BackgroundJobNotice: the background job notice over the job store (P1b design gate row (a)): a job finished,
// failed or needs an answer while the person is on another tab. A hook the Shell calls, since only the Shell knows
// which feature is on screen, owns the toast queue and fills DesktopShell's `tabBadges` (shared/ cannot import
// app/). A job's owner is the feature its kind is named under (`about.demoJob` belongs to `about`).
//
// - The tab icon (JobTabIcon) instead of a count. "Needs your answer" is read from the store, so it survives a
//   reload, and stays until the job is answered (even on its own tab). "Finished" and "Failed" are kept for a job
//   that ended while its feature was not on screen, and go when the person opens that feature. Only features with a
//   tab get one; others (About, which has no tab) get the toast only.
// - The toast, one template ("{Job} finished", "{Job} failed", "{Job} is waiting for you"), for a change the
//   window saw happen while the owner was not on screen: jobs first seen already ended or waiting (a reload's
//   `jobs.list`) raise none. "Show" runs the owner's show command (`<feature>.show`, from `showCommand`); without
//   one the toast has no "Show". A waiting job's toast closes once the job stops waiting.
// - No running-jobs list until P6. A cancelled job raises nothing: the person stopped it.
import type { Job, JobState } from "@ak-studio/contract";
import {
	type BackgroundJobEvent,
	backgroundJobNotice,
	JobTabIcon,
	notifyBackgroundResult,
	type ToastQueue,
} from "@ak-studio/ui";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useJobStore } from "../jobs/jobStore";

/** The feature a job belongs to: the namespace of its kind. */
export function ownerOf(job: Pick<Job, "kind">): string {
	return job.kind.split(".")[0] ?? job.kind;
}

const EVENT_OF: Partial<Record<JobState, BackgroundJobEvent>> = {
	"waiting-for-user": "waiting",
	succeeded: "finished",
	failed: "failed",
};

export interface BackgroundJobNoticeOptions {
	toasts: ToastQueue;
	/** The feature on screen now (the current route's feature), if any. */
	onScreen: string | undefined;
	/** The features that have a tab: only these get an icon. */
	tabs: readonly string[];
	/** How "Show" takes the person to a feature's job (running its show command); undefined when it has none. */
	showCommand: (featureId: string) => (() => void) | undefined;
}

/** The background job notices: returns the tab icons for DesktopShell's `tabBadges`, and raises the toasts. */
export function useBackgroundJobNotice({
	toasts,
	onScreen,
	tabs,
	showCommand,
}: BackgroundJobNoticeOptions): Partial<Record<string, ReactNode>> {
	const jobs = useJobStore((state) => state.jobs);
	/** Each job's state as last seen, to tell a change the window saw from a job it learnt of later. */
	const seen = useRef(new Map<string, JobState>());
	/** The open "is waiting for you" toast of each job. */
	const waitingToasts = useRef(new Map<string, string>());
	/** A finished or failed job's event, by owner, until the owner is opened. */
	const [unseen, setUnseen] = useState<Record<string, BackgroundJobEvent>>({});
	const latest = useRef({ onScreen, showCommand, toasts });
	latest.current = { onScreen, showCommand, toasts };

	useEffect(() => {
		const {
			onScreen: current,
			showCommand: show,
			toasts: queue,
		} = latest.current;
		const ended: Record<string, BackgroundJobEvent> = {};
		for (const job of Object.values(jobs)) {
			const before = seen.current.get(job.id);
			seen.current.set(job.id, job.state);
			const toastKey = waitingToasts.current.get(job.id);
			if (toastKey && job.state !== "waiting-for-user") {
				queue.close(toastKey);
				waitingToasts.current.delete(job.id);
			}
			if (before === undefined || before === job.state) continue;
			const event = EVENT_OF[job.state];
			const owner = ownerOf(job);
			if (!event || owner === current) continue;
			const key = notifyBackgroundResult(
				queue,
				backgroundJobNotice({
					event,
					jobTitle: job.title,
					description:
						event === "waiting"
							? job.request?.title
							: event === "failed"
								? job.error?.message
								: undefined,
					onShow: show(owner),
				}),
			);
			if (event === "waiting") waitingToasts.current.set(job.id, key);
			else ended[owner] = event;
		}
		if (Object.keys(ended).length > 0)
			setUnseen((was) => ({ ...was, ...ended }));
	}, [jobs]);

	// Opening a feature clears its finished and failed icons.
	useEffect(() => {
		if (onScreen === undefined) return;
		setUnseen((was) => {
			if (!(onScreen in was)) return was;
			const { [onScreen]: _cleared, ...rest } = was;
			return rest;
		});
	}, [onScreen]);

	return useMemo(() => {
		const waiting = new Set(
			Object.values(jobs)
				.filter((job) => job.state === "waiting-for-user")
				.map(ownerOf),
		);
		const badges: Partial<Record<string, ReactNode>> = {};
		for (const tab of tabs) {
			const event = waiting.has(tab) ? "waiting" : unseen[tab];
			if (event) badges[tab] = <JobTabIcon event={event} />;
		}
		return badges;
	}, [jobs, tabs, unseen]);
}
