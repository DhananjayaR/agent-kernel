// ErrorView: any StudioError, shown where the feedback placement rule puts it (architecture.md, Errors;
// conventions-and-skills.md, feedback placement: inline for a field or a control, a banner for a view, a toast only
// for something that finished in the background). The placement is the error catalogue's for its code
// (errorPresentation), unless the view passes its own.
//
// - **inline** and **banner**: the empty, cannot-read and error family (StateMessage) in its banner frame where the
//   view puts it (beside the control, or at the top of the view). With `frame="centred"` (nothing is left to show)
//   the centred frame instead. A file and line make it "cannot read" (the file as a PathChip with the line).
// - **toast**: raised once per error (by what it says) through the failure notice the Shell binds (a danger toast,
//   with the next action as its button); nothing renders in place.
//
// The slots come from presentError: the catalogue's title (what happened), the error's message (what to do), its file
// and line, its detail (raw output, masked by the service, collapsed), and its action, an app command run through
// runReported (a failure of that command is reported too).
import type { StudioError } from "@ak-studio/contract";
import { StateMessage } from "@ak-studio/ui";
import { type ReactNode, useEffect, useRef } from "react";
import { type ErrorPlacement, errorPresentation } from "../errors/presentation";
import { noticeFailure } from "./failureNotice";
import { presentError } from "./presentError";

export interface ErrorViewProps {
	/**
	 * The error. A toast-placed one is raised once per error by what it says: to raise the same failure again (a retry
	 * that failed the same way), remount the view or clear the error between attempts.
	 */
	error: StudioError;
	/** Where it shows; the catalogue's placement for its code by default. */
	placement?: ErrorPlacement;
	/** `centred` when nothing is left to show; a banner (`banner`) over what is, by default. Not for a toast. */
	frame?: "centred" | "banner";
	/** More actions after the next action (an AI alternative, once the coding agent exists). */
	actions?: ReactNode;
	/** The centred frame's heading level (default 2). */
	headingLevel?: 2 | 3 | 4;
	className?: string;
}

export function ErrorView({
	error,
	placement,
	frame = "banner",
	actions,
	headingLevel,
	className,
}: ErrorViewProps) {
	const where = placement ?? errorPresentation(error.code).placement;
	const slots = presentError(error);

	// A toast is raised once per error (StrictMode's second effect run, and re-renders, do not raise it again). The
	// error is told apart by what it says, not by object identity, so a parent passing a new literal each render
	// does not raise it again.
	const raised = useRef<string | undefined>(undefined);
	const said = JSON.stringify([
		error.code,
		error.message,
		error.detail,
		error.file,
		error.line,
	]);
	useEffect(() => {
		if (where !== "toast" || raised.current === said) return;
		raised.current = said;
		const { title, description, action } = presentError(error);
		noticeFailure(
			{
				title,
				...(typeof description === "string" ? { description } : {}),
				...(action ? { action } : {}),
			},
			`${error.code}: ${error.message}`,
		);
	}, [where, error, said]);

	if (where === "toast") return null;
	return (
		<StateMessage
			kind={error.file === undefined ? "error" : "cannot-read"}
			frame={frame}
			{...slots}
			actions={actions}
			headingLevel={headingLevel}
			className={className}
		/>
	);
}
