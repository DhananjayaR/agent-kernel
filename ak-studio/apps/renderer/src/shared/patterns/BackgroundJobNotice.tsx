// BackgroundJobNotice: the background job notice over the job store (P1b design gate row (a)): a job finished,
// failed or needs an answer while the person is on another tab. A hook the Shell calls, since only the Shell knows
// which feature is on screen, owns the toast queue and fills DesktopShell's `tabBadges` (shared/ cannot import
// app/). A job's owner is declared, not inferred: the feature whose manifest lists its kind in `jobs` (the
// registry's `ownerOfJob`), and "Show" runs the command its manifest names as `show`.
//
// - The tab icon (JobTabIcon) instead of a count, by severity: waiting > failed > finished. "Needs your answer" is
//   read from the store, so it survives a reload, and stays until the job is answered (even on its own tab). A
//   failed or finished notice is kept for a job that ended while its feature was not on screen; a failure is never
//   replaced by a later success, and either goes when the person opens that feature or presses "Show". Only
//   features with a tab get one; others get the toast only.
// - The toast, one template ("{Job} finished", "{Job} failed", "{Job} is waiting for you"), for a change the
//   window saw happen while the owner was not on screen: jobs first seen already ended or waiting (a reload's
//   `jobs.list`) raise none. A failure's line says what happened (the error catalogue's title). The waiting toast
//   never times out, with or without "Show", and closes once the job stops waiting.
// - No running-jobs list until P6. A cancelled job raises nothing: the person stopped it.
import type { Job, JobState } from "@ak-studio/contract";
import {
	type BackgroundJobEvent,
	backgroundJobNotice,
	JobTabIcon,
	notifyBackgroundResult,
	type ToastQueue,
} from "@ak-studio/ui";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { errorPresentation } from "../errors/presentation";
import { useJobStore } from "../jobs/jobStore";

const EVENT_OF: Partial<Record<JobState, BackgroundJobEvent>> = {
	"waiting-for-user": "waiting",
	succeeded: "finished",
	failed: "failed",
};

/** An ended job's notice kept on its tab; a failure outranks a success. */
type Ended = "failed" | "finished";

/** The more severe of two ended notices. */
function severer(a: Ended | undefined, b: Ended): Ended {
	return a === "failed" || b === "failed" ? "failed" : "finished";
}

export interface BackgroundJobNoticeOptions {
	toasts: ToastQueue;
	/** The feature on screen now (the current route's feature), if any. */
	onScreen: string | undefined;
	/** The features that have a tab: only these get an icon. */
	tabs: readonly string[];
	/** The feature that owns a job kind (the registry's `ownerOfJob`); undefined for a kind no manifest owns. */
	ownerOf: (kind: string) => string | undefined;
	/** Brings a feature on screen (runs its manifest's `show` command); undefined when it declares none. */
	showCommand: (featureId: string) => (() => void) | undefined;
}

/** The background job notices: returns the tab icons for DesktopShell's `tabBadges`, and raises the toasts. */
export function useBackgroundJobNotice({
	toasts,
	onScreen,
	tabs,
	ownerOf,
	showCommand,
}: BackgroundJobNoticeOptions): Partial<Record<string, ReactNode>> {
	const jobs = useJobStore((state) => state.jobs);
	/** Each job's state as last seen, to tell a change the window saw from a job it learnt of later. */
	const seen = useRef(new Map<string, JobState>());
	/** The open "is waiting for you" toast of each job. */
	const waitingToasts = useRef(new Map<string, string>());
	/** The ended notice kept per owner until the person opens it. */
	const [unseen, setUnseen] = useState<Record<string, Ended>>({});
	/** Clears an owner's ended notice (opened, or "Show" pressed). */
	const clearOwner = useCallback((owner: string) => {
		setUnseen((was) => {
			if (!(owner in was)) return was;
			const { [owner]: _cleared, ...rest } = was;
			return rest;
		});
	}, []);
	const latest = useRef({ onScreen, ownerOf, showCommand, toasts });
	latest.current = { onScreen, ownerOf, showCommand, toasts };

	useEffect(() => {
		const {
			onScreen: current,
			ownerOf: owns,
			showCommand: show,
			toasts: queue,
		} = latest.current;
		const ended: Record<string, Ended> = {};
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
			const owner = owns(job.kind);
			if (!event || (owner !== undefined && owner === current)) continue;
			const showOwner = owner === undefined ? undefined : show(owner);
			const key = notifyBackgroundResult(
				queue,
				backgroundJobNotice({
					event,
					jobTitle: job.title,
					description: describe(job, event),
					// "Show" also clears the owner's ended notice: the person has gone to see it.
					onShow:
						owner === undefined || showOwner === undefined
							? undefined
							: () => {
									clearOwner(owner);
									showOwner();
								},
				}),
			);
			if (event === "waiting") waitingToasts.current.set(job.id, key);
			else if (owner !== undefined) ended[owner] = severer(ended[owner], event);
		}
		if (Object.keys(ended).length > 0)
			setUnseen((was) => {
				const next = { ...was };
				for (const [owner, event] of Object.entries(ended))
					next[owner] = severer(next[owner], event);
				return next;
			});
	}, [jobs, clearOwner]);

	// Opening a feature clears its ended notice.
	useEffect(() => {
		if (onScreen !== undefined) clearOwner(onScreen);
	}, [onScreen, clearOwner]);

	return useMemo(() => {
		const waiting = new Set<string>();
		for (const job of Object.values(jobs)) {
			const owner =
				job.state === "waiting-for-user" ? ownerOf(job.kind) : undefined;
			if (owner !== undefined) waiting.add(owner);
		}
		const badges: Partial<Record<string, ReactNode>> = {};
		for (const tab of tabs) {
			const event: BackgroundJobEvent | undefined = waiting.has(tab)
				? "waiting"
				: unseen[tab];
			if (event) badges[tab] = <JobTabIcon event={event} />;
		}
		return badges;
	}, [jobs, tabs, unseen, ownerOf]);
}

/** The toast's one line: the question, what happened (the catalogue's title for the error), or nothing. */
function describe(job: Job, event: BackgroundJobEvent): string | undefined {
	if (event === "waiting") return job.request?.title;
	if (event === "failed" && job.error)
		return errorPresentation(job.error.code).title;
	return undefined;
}
