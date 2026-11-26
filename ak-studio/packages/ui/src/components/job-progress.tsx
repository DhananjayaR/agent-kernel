// JobProgressView: a long operation shown inline in the view that started it (the job progress pattern, P1b design
// gate row (a), signed off 26 November 2026). Presentational: the connected JobProgress (the renderer's
// shared/patterns) fills it from the job store. Several jobs in one view stack, newest first (JobProgressStack).
//
// A card with the job's title (its accessible name), a StatusChip for its state, the current step ("Step 2 of 3 ·
// Preparing the demo") announced through one polite live region that lives as long as the card (it also says the
// end: "Done", "Stopped before it finished.", and is the card's description), and the elapsed time in monospace figures ("1 min 12 s"), shown
// from one second on and only while the job runs or waits (the parent passes it from a clock it can freeze). While
// it runs: "Stop" (secondary; "Stop", as drawn, because it stops a process; "Cancel" stays for dialogs), with the
// job's own caution line where stopping is unsafe, and "Show commands" when the job ran commands (it opens the
// Commands panel). A question the job asks shows inside it (`children`: the approval card). It ends in a one-line
// result with "Done", "Stopped", or the error with its next action, in the error family's banner (ErrorBanner, the
// frame the renderer's ErrorView uses). When "Stop" goes away (the job ended), focus that was on it moves to the card.
import type { ReactNode } from "react";
import { useId } from "react";
import { useKeepFocus } from "../lib/focus";
import { cn } from "../lib/utils";
import { fillString, type JobProgressStrings, uiStrings } from "../strings";
import { Button } from "./button";
import { ErrorBanner, type ErrorSlots } from "./state-message";
import { type Status, StatusChip } from "./status-chip";

export type JobProgressState =
	| "queued"
	| "running"
	| "waiting"
	| "succeeded"
	| "failed"
	| "cancelled";

/** The job's StatusChip per state. "Stopped" reuses the not-set-up icon (a dashed circle: not finished, no fault). */
const CHIP: Record<JobProgressState, Status> = {
	queued: "waiting",
	running: "running",
	waiting: "waiting",
	succeeded: "passed",
	failed: "failed",
	cancelled: "not-set-up",
};

/** Under this long, no time is shown (feedback timing: a labelled job from one second). */
export const ELAPSED_SHOWN_FROM_MS = 1000;

/** "12 s", "1 min 12 s", "1 h 4 min": whole seconds, then minutes, then hours. */
export function formatElapsed(ms: number): string {
	const seconds = Math.max(0, Math.floor(ms / 1000));
	if (seconds < 60) return `${seconds} s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes} min ${seconds % 60} s`;
	return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/**
 * The error a failed job ended with, in the empty, cannot-read and error family's slots: what happened, what to do,
 * the file and line, the raw detail and the next action (an app command, run by `onAction`).
 */
export type JobProgressError = ErrorSlots;

export type JobProgressViewProps = {
	/** The job's title, sentence case ("Detecting the toolchain"). Its accessible name. */
	title: string;
	state: JobProgressState;
	/** The current step, when the job reports one. */
	step?: { step: number; steps: number; label: string };
	/** How long it has run; shown from one second while it runs or waits. */
	elapsedMs?: number;
	/** Stops the job; "Stop" shows only while it runs or waits and only when given (the job is cancellable). */
	onStop?: () => void;
	/** The stop is on its way. */
	stopPending?: boolean;
	/** Why stopping is unsafe, shown beside "Stop" ("Stopping can leave some resources created."). */
	stopCaution?: string;
	/** Opens the Commands panel on the job's commands; "Show commands" shows only when given. */
	onShowCommands?: () => void;
	/** The result in one line, once it succeeded. */
	result?: ReactNode;
	/** What went wrong, once it failed. */
	error?: JobProgressError;
	/** A stop that could not be sent, shown under the actions. */
	stopError?: ErrorSlots;
	/** The question the job asks while it waits (the approval card). */
	children?: ReactNode;
	strings?: Partial<JobProgressStrings>;
	className?: string;
};

export function JobProgressView({
	title,
	state,
	step,
	elapsedMs,
	onStop,
	stopPending,
	stopCaution,
	onShowCommands,
	result,
	error,
	stopError,
	children,
	strings,
	className,
}: JobProgressViewProps) {
	const text = { ...uiStrings.jobProgress, ...strings };
	const titleId = useId();
	const active =
		state === "queued" || state === "running" || state === "waiting";
	const ref = useKeepFocus<HTMLElement>(active);
	const showElapsed =
		(state === "running" || state === "waiting") &&
		elapsedMs !== undefined &&
		elapsedMs >= ELAPSED_SHOWN_FROM_MS;
	const canStop = active && onStop !== undefined;
	const statusId = useId();
	const stepText = step
		? fillString(text.step, {
				step: step.step,
				steps: step.steps,
				label: step.label,
			})
		: undefined;
	// What the live region says: the step while it runs, the state otherwise. One region for the card's whole life,
	// so each change is announced (a region inserted already filled often is not); not the ticking time.
	const announcement =
		state === "running" || state === "queued"
			? (stepText ?? text[state])
			: state === "succeeded"
				? typeof result === "string"
					? fillString(text.succeededWith, { result })
					: text.succeeded
				: state === "cancelled"
					? text.cancelledResult
					: text[state];
	return (
		<section
			ref={ref}
			tabIndex={-1}
			data-slot="job-progress"
			data-state={state}
			aria-labelledby={titleId}
			aria-describedby={statusId}
			className={cn(
				"flex flex-col gap-3 rounded-card border border-border-default bg-surface-raised p-4 text-ui text-text outline-none focus-visible:focus-outline",
				className,
			)}
		>
			<p id={statusId} role="status" className="sr-only">
				{announcement}
			</p>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
				<h3
					id={titleId}
					className="min-w-0 flex-1 font-heading text-ui-lg font-bold text-text"
				>
					{title}
				</h3>
				<StatusChip status={CHIP[state]} label={text[state]} />
			</div>
			{active && (step || showElapsed) ? (
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
					{/* The live region says the step; this is its visible copy. */}
					<p aria-hidden="true" className="min-w-0 flex-1">
						{stepText}
					</p>
					{showElapsed ? (
						<span className="mono-figures text-ui-sm text-text-muted">
							<span className="sr-only">{text.elapsed} </span>
							{formatElapsed(elapsedMs)}
						</span>
					) : null}
				</div>
			) : null}
			{children}
			{canStop || (active && onShowCommands) ? (
				<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
					{canStop ? (
						<Button
							variant="secondary"
							isPending={stopPending}
							onPress={onStop}
						>
							{text.stop}
						</Button>
					) : null}
					{canStop && stopCaution ? (
						<p className="min-w-0 flex-1 text-ui-sm text-text-muted">
							{stopCaution}
						</p>
					) : null}
					{onShowCommands ? (
						<Button variant="ghost" onPress={onShowCommands}>
							{text.showCommands}
						</Button>
					) : null}
				</div>
			) : null}
			{stopError && active ? <ErrorBanner error={stopError} /> : null}
			{state === "succeeded" && result ? <div>{result}</div> : null}
			{state === "cancelled" ? (
				<p aria-hidden="true" className="text-text-muted">
					{text.cancelledResult}
				</p>
			) : null}
			{state === "failed" && error ? <ErrorBanner error={error} /> : null}
			{!active && onShowCommands ? (
				<div>
					{/* Pulled back by the quiet button's padding, so its label lines up with the text above. */}
					<Button variant="ghost" className="-ms-3" onPress={onShowCommands}>
						{text.showCommands}
					</Button>
				</div>
			) : null}
		</section>
	);
}

export type JobProgressStackProps = {
	/** One JobProgressView (or connected JobProgress) per job, newest first. */
	children: ReactNode;
	className?: string;
};

/** Several jobs in one view: each its own block, newest first, nothing hidden (design gate row (a)). */
export function JobProgressStack({
	children,
	className,
}: JobProgressStackProps) {
	return (
		<div
			data-slot="job-progress-stack"
			className={cn("flex flex-col gap-3", className)}
		>
			{children}
		</div>
	);
}
