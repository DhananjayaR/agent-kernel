// StateMessage: one family for a view's empty, cannot-read and error states (P1b design gate row (d), signed off 26
// November 2026: "two frames, one set of slots"). The same slots everywhere: a title (what happened, or what this
// place is for), a description (what to do), the file and line (a PathChip with the line, for cannot-read), the
// raw detail (masked by the service, collapsed by default), and the next action (one app command, plus an AI
// alternative once the coding agent exists). The rule for the frame is one question: is anything left to show?
//
// - **centred** (nothing is left: an empty view, or an error that left nothing to show): the EmptyState frame. An
//   error or cannot-read shows the danger icon beside its words (never colour alone) and is announced (role
//   "alert"); an empty state is not.
// - **banner** (something is left: partial results, a working view with an error): an InlineBanner at the top of
//   the view, placed as the changed-on-disk banner is (in the flow; floating over a canvas). Danger for an error
//   or cannot-read (announced as an alert), info for an empty state.
//
// Presentational: the renderer's ErrorView fills it from a StudioError (code, message, detail, file, line, action)
// and places it by the error catalogue's placement. Views with their own error slot (JobProgressView,
// SessionControlView, StreamingListView) render ErrorSlots through ErrorBanner, so every error reads the same.
import { IconChevronRight, IconCircleX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Disclosure, DisclosurePanel } from "react-aria-components";
import { cn } from "../lib/utils";
import { type StateMessageStrings, uiStrings } from "../strings";
import { Button } from "./button";
import { CodeBlock } from "./code-block";
import { EmptyState } from "./empty-state";
import { InlineBanner } from "./inline-banner";
import { PathChip } from "./path-chip";

export type StateMessageKind = "empty" | "cannot-read" | "error";

/** The next action: an app command the person can run (the error's `action`), as a button. */
export type StateAction = { label: string; onAction: () => void };

/** An error as the family shows it: what happened, what to do, where, the raw detail and the next action. */
export type ErrorSlots = {
	/** What happened, in one line (the error catalogue's title for its code). */
	title: string;
	/** What to do next (the error's own message). */
	description?: ReactNode;
	/** The file it is about (cannot read), relative to the project. */
	file?: string;
	/** The line in `file`, 1-based. */
	line?: number;
	/** Raw output, already masked; collapsed until asked for. */
	detail?: string;
	action?: StateAction;
};

export type StateMessageProps = Omit<ErrorSlots, "description"> & {
	kind: StateMessageKind;
	/** `centred` when nothing is left to show; `banner` when something is (partial results). */
	frame: "centred" | "banner";
	/** What to do next; for an empty state, what this place is for and how to fill it. */
	description?: ReactNode;
	/** An icon for an empty state (Tabler outline), decorative; errors use the danger icon. */
	icon?: ReactNode;
	/** More actions after the next action (an AI alternative, "Show log"). */
	actions?: ReactNode;
	/** The centred frame's heading level (default 2). */
	headingLevel?: 2 | 3 | 4;
	strings?: Partial<StateMessageStrings>;
	className?: string;
};

/** The raw detail, collapsed: a React Aria disclosure (its trigger a quiet button) over a CodeBlock. */
function Detail({
	detail,
	label,
	caption,
	centred,
}: {
	detail: string;
	label: string;
	caption: string;
	/** In the centred frame the toggle is centred under the words; the opened output stays full width. */
	centred: boolean;
}) {
	return (
		<Disclosure
			data-slot="state-detail"
			className={cn(
				"group flex w-full flex-col text-start",
				centred ? "items-center" : "items-start",
			)}
		>
			<Button
				slot="trigger"
				variant="ghost"
				icon={
					<IconChevronRight
						aria-hidden="true"
						className="group-data-expanded:rotate-90"
					/>
				}
				className={centred ? undefined : "-ms-3"}
			>
				{label}
			</Button>
			<DisclosurePanel className="w-full">
				<CodeBlock code={detail} label={caption} className="mt-2" />
			</DisclosurePanel>
		</Disclosure>
	);
}

/** The location, detail and description of a message: the slots below the title, in order. */
function Body({
	description,
	file,
	line,
	detail,
	text,
	centred,
}: {
	description?: ReactNode;
	file?: string;
	line?: number;
	detail?: string;
	text: StateMessageStrings;
	centred: boolean;
}) {
	return (
		<>
			{!centred && description ? <div>{description}</div> : null}
			{file ? (
				<div>
					<PathChip path={file} line={line} />
				</div>
			) : null}
			{detail ? (
				<Detail
					detail={detail}
					label={text.details}
					caption={text.output}
					centred={centred}
				/>
			) : null}
		</>
	);
}

export function StateMessage({
	kind,
	frame,
	title,
	description,
	file,
	line,
	detail,
	action,
	actions,
	icon,
	headingLevel,
	strings,
	className,
}: StateMessageProps) {
	const text = { ...uiStrings.stateMessage, ...strings };
	const failed = kind !== "empty";
	const buttons =
		action || actions ? (
			<>
				{action ? (
					<Button variant="secondary" onPress={action.onAction}>
						{action.label}
					</Button>
				) : null}
				{actions}
			</>
		) : undefined;

	if (frame === "banner") {
		return (
			<InlineBanner
				data-kind={kind}
				tone={failed ? "danger" : "info"}
				title={title}
				actions={buttons}
				className={className}
			>
				{description || file || detail ? (
					<div className="flex flex-col gap-2">
						<Body
							description={description}
							file={file}
							line={line}
							detail={detail}
							text={text}
							centred={false}
						/>
					</div>
				) : null}
			</InlineBanner>
		);
	}

	const centred = (
		<EmptyState
			title={title}
			description={typeof description === "string" ? description : ""}
			icon={
				failed ? (
					<IconCircleX aria-hidden="true" className="text-text-status-danger" />
				) : (
					icon
				)
			}
			action={buttons}
			headingLevel={headingLevel}
		>
			{typeof description !== "string" && description ? (
				<div className="text-ui text-text-muted">{description}</div>
			) : null}
			{file || detail ? (
				<Body file={file} line={line} detail={detail} text={text} centred />
			) : null}
		</EmptyState>
	);
	return (
		<div
			data-slot="state-message"
			data-kind={kind}
			role={failed ? "alert" : undefined}
			className={className}
		>
			{centred}
		</div>
	);
}

/** An error in a view's own error slot (a job, a session, a stream): the family's banner frame. */
export function ErrorBanner({
	error,
	className,
}: {
	error: ErrorSlots;
	className?: string;
}) {
	return (
		<StateMessage
			kind={error.file ? "cannot-read" : "error"}
			frame="banner"
			{...error}
			className={className}
		/>
	);
}
