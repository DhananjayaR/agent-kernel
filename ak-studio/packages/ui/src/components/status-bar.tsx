// StatusBar: the 32 px bar at the bottom of the window (the `contentinfo` landmark). At the start: the working
// directory (PathChip) and the git branch. At the end: the Python environment, the file sync state and the coding
// agent's state (StatusChips: icon and label), the project's OAK version (a slot P2 fills, with its own
// design at P2's gate), and the Studio's own version. Every item is optional: an item with nothing to say is not
// drawn. It never scrolls sideways: the path shrinks first (cut in the middle, the folder name kept), then the
// branch; the start keeps at least 128 px. Items at the end keep their size; below about 1100 px, with every item
// present, the last ones are cut off at the window's edge (story `At800Compact`). P2's design gate settles the
// status bar's own narrow rule, with the version slot.
//
// The coding agent's item carries the AI colour on its sparkle (the AI colour marks the coding agent only).
import { IconGitBranch, IconSparkles } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { type StatusBarStrings, uiStrings } from "../strings";
import { PathChip } from "./path-chip";
import { type Status, StatusChip } from "./status-chip";

/** One state in the status bar: the StatusChip's status and the label to show. */
export type StatusBarState = { status: Status; label: string };

export type StatusBarProps = {
	/** The project's folder, as the person reads it ("~/code/support-triage"). */
	workingDirectory?: string;
	onRevealWorkingDirectory?: () => void;
	onCopyWorkingDirectory?: (path: string) => void;
	/** The git branch, when the folder is a repository. */
	gitBranch?: string;
	python?: StatusBarState;
	fileSync?: StatusBarState;
	codingAgent?: StatusBarState;
	/** The project's OAK version: the slot P2 fills. */
	kernelVersion?: ReactNode;
	/** The Studio's own version ("0.1.0"). */
	appVersion?: string;
	/** Overrides of the default copy (strings.ts). */
	strings?: Partial<StatusBarStrings>;
	className?: string;
};

export function StatusBar({
	workingDirectory,
	onRevealWorkingDirectory,
	onCopyWorkingDirectory,
	gitBranch,
	python,
	fileSync,
	codingAgent,
	kernelVersion,
	appVersion,
	strings,
	className,
}: StatusBarProps) {
	const text = { ...uiStrings.statusBar, ...strings };
	return (
		<footer
			data-slot="status-bar"
			className={cn(
				"flex h-control-m w-full min-w-0 shrink-0 items-center gap-4 overflow-hidden border-t border-border-default bg-surface-raised px-3 text-ui-sm text-text",
				className,
			)}
		>
			<div
				data-slot="status-bar-start"
				className="flex min-w-32 flex-1 items-center gap-4 overflow-hidden"
			>
				{workingDirectory ? (
					<PathChip
						path={workingDirectory}
						onReveal={onRevealWorkingDirectory}
						onCopy={onCopyWorkingDirectory}
						className="min-w-0 shrink"
					/>
				) : null}
				{gitBranch ? (
					<span
						data-slot="git-branch"
						className="flex min-w-0 shrink items-center gap-1.5"
					>
						<IconGitBranch aria-hidden="true" className="size-4 shrink-0" />
						<span className="sr-only">{text.gitBranch}</span>
						<span className="truncate font-mono">{gitBranch}</span>
					</span>
				) : null}
			</div>
			<div
				data-slot="status-bar-end"
				className="flex min-w-0 shrink items-center gap-3 overflow-hidden *:shrink-0"
			>
				{python ? (
					<StatusChip status={python.status} label={python.label} />
				) : null}
				{fileSync ? (
					<StatusChip status={fileSync.status} label={fileSync.label} />
				) : null}
				{codingAgent ? (
					<span data-slot="coding-agent" className="flex items-center gap-1.5">
						<IconSparkles
							aria-hidden="true"
							className="size-4 shrink-0 text-text-accent-ai"
						/>
						<StatusChip status={codingAgent.status} label={codingAgent.label} />
					</span>
				) : null}
				{kernelVersion ? (
					<span data-slot="kernel-version" className="flex items-center">
						{kernelVersion}
					</span>
				) : null}
				{appVersion ? (
					<span data-slot="app-version" className="whitespace-nowrap">
						{text.appName}{" "}
						<span data-slot="app-version-number" className="mono-figures">
							{appVersion}
						</span>
					</span>
				) : null}
			</div>
		</footer>
	);
}
