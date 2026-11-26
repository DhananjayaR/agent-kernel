// SessionControlView: something long-lived that runs until stopped (the session control pattern: state, start and
// stop, key facts, a link to its log; P1b design gate row (b), signed off 26 November 2026). Presentational: the
// connected SessionControl (the renderer's shared/patterns) fills it from the session store. The top bar's local
// run keeps its own compact form, RunControl (top-bar-controls.tsx), as built in P1a; this is the same shape for a
// view: the About ticker in P1b, the coding agent's drawer later.
//
// A named group: the session's name, its state as a StatusChip (never colour alone), its key facts as a list of
// label and monospace value (port, model, start time), and one button that starts or stops it. The button is the
// same element in every state, only its label and action change, so focus stays on it from "Start" to "Stop" and
// back. It is secondary: a view's one primary action is its own. While a start or stop is on its way (past 300 ms,
// the caller decides) the button is pending. A session that failed says what happened and what to do in a danger
// banner, and offers "Show log" when it has one; so does a running one, as a quiet link.
import {
	IconPlayerPlay,
	IconPlayerStop,
	IconScript,
} from "@tabler/icons-react";
import { type HTMLAttributes, type ReactNode, useId } from "react";
import { cn } from "../lib/utils";
import { type SessionControlStrings, uiStrings } from "../strings";
import { Button } from "./button";
import { ErrorBanner, type ErrorSlots } from "./state-message";
import { type Status, StatusChip } from "./status-chip";

export type SessionControlState =
	| "stopped"
	| "starting"
	| "running"
	| "stopping"
	| "failed";

const CHIP: Record<SessionControlState, Status> = {
	stopped: "not-set-up",
	starting: "running",
	running: "passed",
	stopping: "running",
	failed: "failed",
};

/** One key fact: a label and its value, shown in monospace ("Port", "8000"). */
export type SessionFact = { label: string; value: ReactNode };

export type SessionControlViewProps = Omit<
	HTMLAttributes<HTMLElement>,
	"children"
> & {
	/** What the session is ("Demo ticker"); the group's name. */
	title: string;
	state: SessionControlState;
	/** Its key facts while it runs (port, model, start time). */
	facts?: readonly SessionFact[];
	/** Starts it; the button shows "Start" while it is stopped or failed, when given. */
	onStart?: () => void;
	/** Stops it; the button shows "Stop" while it starts or runs, when given. */
	onStop?: () => void;
	/** A start or stop is on its way. */
	pending?: boolean;
	/** Shows its log (the bottom panel's view of its output); "Show log" when given. */
	onShowLog?: () => void;
	/** Why it failed, or why a start or stop was refused: what happened, then what to do. */
	error?: ErrorSlots;
	/** Overrides of the default copy (strings.ts). */
	strings?: Partial<SessionControlStrings>;
};

export function SessionControlView({
	title,
	state,
	facts = [],
	onStart,
	onStop,
	pending = false,
	onShowLog,
	error,
	strings,
	className,
	...props
}: SessionControlViewProps) {
	const text = { ...uiStrings.sessionControl, ...strings };
	const titleId = useId();
	const live =
		state === "starting" || state === "running" || state === "stopping";
	// One button: Stop while it lives (pending while stopping), Start otherwise.
	const action = live
		? onStop && {
				label: text.stop,
				icon: <IconPlayerStop aria-hidden="true" />,
				onPress: onStop,
			}
		: onStart && {
				label: text.start,
				icon: <IconPlayerPlay aria-hidden="true" />,
				onPress: onStart,
			};
	return (
		<section
			data-slot="session-control"
			data-state={state}
			aria-labelledby={titleId}
			className={cn("flex min-w-0 flex-col gap-3", className)}
			{...props}
		>
			<div className="flex min-h-control-m flex-wrap items-center gap-3">
				<h3 id={titleId} className="text-ui font-control text-text">
					{title}
				</h3>
				<StatusChip status={CHIP[state]} label={text[state]} />
				<span className="flex-1" />
				{onShowLog ? (
					<Button
						variant="ghost"
						icon={<IconScript aria-hidden="true" />}
						onPress={onShowLog}
					>
						{text.showLog}
					</Button>
				) : null}
				{action ? (
					<Button
						key="toggle"
						variant="secondary"
						icon={action.icon}
						isPending={pending || state === "stopping"}
						onPress={action.onPress}
					>
						{action.label}
					</Button>
				) : null}
			</div>
			{facts.length > 0 ? (
				<dl className="flex flex-col gap-1 text-ui-sm">
					{facts.map((fact) => (
						<div key={fact.label} className="flex min-w-0 gap-2">
							<dt className="shrink-0 text-text-muted">{fact.label}</dt>
							<dd className="min-w-0 font-mono wrap-anywhere text-text">
								{fact.value}
							</dd>
						</div>
					))}
				</dl>
			) : null}
			{error ? <ErrorBanner error={error} /> : null}
		</section>
	);
}
