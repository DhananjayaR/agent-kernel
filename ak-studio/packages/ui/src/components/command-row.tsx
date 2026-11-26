// CommandRow: a command the app ran on the person's computer (conventions section 1: "A command the app ran:
// CommandRow, never a code block"). Presentational: P2's CommandRunner records each command, and the Commands view
// lists them with this row. One row: the exit status as a StatusChip (running; "Exit 0" passed; a non-zero exit, or
// an end by a signal, failed; "Stopped" for one the app stopped), the executable and its arguments in monospace,
// and how long it took (or has run so far) in monospace figures.
//
// The arguments are shown as the record has them, which the main process has already masked: a secret reads
// `NAME=[hidden]`, never its value (this component never sees one). An argument with a space or a quote is quoted
// so the line reads as it was run. The command wraps rather than truncating: every argument stays readable.
import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils";
import { type CommandRowStrings, fillString, uiStrings } from "../strings";
import { formatElapsed } from "./job-progress";
import { type Status, StatusChip } from "./status-chip";

/** Running; ended by itself (its exit code says how); or stopped by the app. */
export type CommandRowState = "running" | "ended" | "stopped";

/** "320 ms", "4.2 s", then as the job pattern counts ("1 min 12 s"). */
export function formatDuration(ms: number): string {
	const whole = Math.max(0, Math.round(ms));
	if (whole < 1000) return `${whole} ms`;
	if (whole < 60_000) return `${(Math.floor(whole / 100) / 10).toFixed(1)} s`;
	return formatElapsed(whole);
}

/** One argument as typed: quoted when it is empty or holds a space, a quote or a backslash. */
export function quoteArg(arg: string): string {
	if (arg !== "" && !/[\s"'\\]/.test(arg)) return arg;
	return `'${arg.replace(/'/g, `'\\''`)}'`;
}

export type CommandRowProps = Omit<
	HTMLAttributes<HTMLDivElement>,
	"children"
> & {
	/** The program, as run (`uv`, `terraform`). */
	executable: string;
	/** Its arguments, already masked by the main process. */
	args: readonly string[];
	state: CommandRowState;
	/**
	 * The exit code once it ended: 0 passed, any other failed; null when it ended by a signal (failed). Ended with no
	 * code given (a record that lacks it) reads "Ended", with no verdict.
	 */
	exitCode?: number | null;
	/** How long it ran, or has run so far. */
	durationMs?: number;
	/** Overrides of the default copy (strings.ts). */
	strings?: Partial<CommandRowStrings>;
};

export function CommandRow({
	executable,
	args,
	state,
	exitCode,
	durationMs,
	strings,
	className,
	...props
}: CommandRowProps) {
	const text = { ...uiStrings.commandRow, ...strings };
	const ended = state === "ended";
	const status: Status =
		state === "running"
			? "running"
			: state === "stopped" || exitCode === undefined
				? "not-set-up"
				: exitCode === 0
					? "passed"
					: "failed";
	const label =
		state === "running"
			? text.running
			: state === "stopped"
				? text.stopped
				: exitCode === undefined
					? text.ended
					: exitCode === null
						? text.signalled
						: fillString(text.exited, { code: exitCode });
	return (
		<div
			data-slot="command-row"
			data-state={state}
			data-exit={ended && typeof exitCode === "number" ? exitCode : undefined}
			className={cn(
				"flex min-h-row min-w-0 items-center gap-3 px-edge py-1",
				className,
			)}
			{...props}
		>
			<StatusChip status={status} label={label} className="shrink-0" />
			<code className="min-w-0 flex-1 font-mono text-ui-sm wrap-anywhere text-text">
				{[executable, ...args].map(quoteArg).join(" ")}
			</code>
			{durationMs !== undefined ? (
				<span className="shrink-0 mono-figures text-ui-sm text-text-muted">
					<span className="sr-only">
						{state === "running" ? text.runningFor : text.duration}{" "}
					</span>
					{formatDuration(durationMs)}
				</span>
			) : null}
		</div>
	);
}
