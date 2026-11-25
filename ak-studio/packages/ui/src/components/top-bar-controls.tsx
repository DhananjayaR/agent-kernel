// The top bar's controls after the tabs: RunControl (the local run, a session control: state, start and stop, the
// port, a link to its log), DeployStatus (whether the project is deployed), BuildWithAIButton (the AI button
// style) and SettingsButton. States are StatusChips (icon and label, never colour alone). In the compact top bar
// (narrower than 1100 px) the run control drops the port and the deploy status its time; Build with AI keeps its
// sparkle and its name, shown in a tooltip.
//
// Presentational: the local run arrives in P8 and deploying in P10. While no project is open (all of P1a) the app
// shows their not-yet states: the run control "No project to run" with no start control (a start button with
// nothing to start would be a dead control), and the deploy status "Not deployed".
import {
	PlayIcon,
	ScrollTextIcon,
	SettingsIcon,
	SparklesIcon,
	SquareIcon,
} from "lucide-react";
import type { ReactElement, RefAttributes } from "react";
import { Group } from "react-aria-components";
import { cn } from "../lib/utils";
import {
	type DeployStatusStrings,
	fillString,
	type RunControlStrings,
	uiStrings,
} from "../strings";
import { Button, type ButtonProps, IconButton } from "./button";
import { useTopBarCompact } from "./desktop-shell";
import { type Status, StatusChip } from "./status-chip";
import { Tooltip } from "./tooltip";

/** The local run's state; `no-project` while no project is open (nothing to run, so no start control). */
export type RunState =
	| "no-project"
	| "stopped"
	| "starting"
	| "running"
	| "failed";

const RUN_STATUS: Record<RunState, Status> = {
	"no-project": "not-set-up",
	stopped: "not-set-up",
	starting: "running",
	running: "passed",
	failed: "failed",
};

export type RunControlProps = {
	state: RunState;
	/** The port the local server listens on, while running. */
	port?: number;
	onStart?: () => void;
	onStop?: () => void;
	/** Shows a "Show the run log" button (the run log is in the bottom panel). */
	onShowLog?: () => void;
	/** Overrides of the default copy (strings.ts). */
	strings?: Partial<RunControlStrings>;
};

function ActionIcon({
	label,
	icon,
	onPress,
}: {
	label: string;
	icon: ReactElement;
	onPress?: () => void;
}) {
	return (
		<Tooltip content={label} placement="bottom">
			<IconButton aria-label={label} icon={icon} onPress={onPress} />
		</Tooltip>
	);
}

/** The local run: its state, start or stop, and (when it failed) a way to its log. No control without a project. */
export function RunControl({
	state,
	port,
	onStart,
	onStop,
	onShowLog,
	strings,
}: RunControlProps) {
	const text = { ...uiStrings.runControl, ...strings };
	const compact = useTopBarCompact();
	const label =
		state === "running"
			? port !== undefined && !compact
				? fillString(text.runningOnPort, { port })
				: text.running
			: state === "no-project"
				? text.noProject
				: text[state];
	const live = state === "starting" || state === "running";
	return (
		<Group
			aria-label={text.group}
			data-slot="run-control"
			data-state={state}
			className="flex shrink-0 items-center gap-1"
		>
			<StatusChip status={RUN_STATUS[state]} label={label} />
			{state === "no-project" ? null : live ? (
				<ActionIcon
					label={text.stop}
					icon={<SquareIcon aria-hidden="true" />}
					onPress={onStop}
				/>
			) : (
				<ActionIcon
					label={text.start}
					icon={<PlayIcon aria-hidden="true" />}
					onPress={onStart}
				/>
			)}
			{state === "failed" && onShowLog ? (
				<ActionIcon
					label={text.showLog}
					icon={<ScrollTextIcon aria-hidden="true" />}
					onPress={onShowLog}
				/>
			) : null}
		</Group>
	);
}

export type DeployState = "not-deployed" | "deployed" | "applying" | "failed";

const DEPLOY_STATUS: Record<DeployState, Status> = {
	"not-deployed": "not-set-up",
	deployed: "passed",
	applying: "running",
	failed: "failed",
};

export type DeployStatusProps = {
	state: DeployState;
	/** When the last deploy finished, as a relative time ("2 h ago"), while deployed. */
	deployedAgo?: string;
	/** Overrides of the default copy (strings.ts). */
	strings?: Partial<DeployStatusStrings>;
};

/** Whether the project is deployed: a StatusChip, read as "Deployment: Not deployed". */
export function DeployStatus({
	state,
	deployedAgo,
	strings,
}: DeployStatusProps) {
	const text = { ...uiStrings.deployStatus, ...strings };
	const compact = useTopBarCompact();
	const label = {
		"not-deployed": text.notDeployed,
		deployed:
			deployedAgo && !compact
				? fillString(text.deployedAgo, { ago: deployedAgo })
				: text.deployed,
		applying: text.applying,
		failed: text.failed,
	}[state];
	return (
		<div
			data-slot="deploy-status"
			data-state={state}
			className="flex shrink-0 items-center"
		>
			<span className="sr-only">{text.group}: </span>
			<StatusChip status={DEPLOY_STATUS[state]} label={label} />
		</div>
	);
}

export type BuildWithAIButtonProps = Omit<
	ButtonProps,
	"variant" | "children" | "icon"
> & {
	/** The label (default "Build with AI"). */
	label?: string;
};

/**
 * "Build with AI", in the AI button style (the only place in the top bar with the AI colour). In the compact top bar
 * the label is visually hidden (it stays the accessible name) and shows in a tooltip.
 */
export function BuildWithAIButton({
	label = uiStrings.buildWithAI.label,
	className,
	...props
}: BuildWithAIButtonProps) {
	const compact = useTopBarCompact();
	// The same tree in both forms (the tooltip is only switched off in the full form), so the button is never
	// remounted when the top bar changes form and keeps focus (and a popover's trigger) across the change.
	return (
		<Tooltip content={label} placement="bottom" isDisabled={!compact}>
			<Button
				data-slot="build-with-ai"
				variant="ai"
				icon={<SparklesIcon aria-hidden="true" />}
				className={cn(compact && "gap-0 px-1.5", className)}
				{...props}
			>
				<span className={cn(compact && "sr-only")}>{label}</span>
			</Button>
		</Tooltip>
	);
}

export type SettingsButtonProps = Omit<
	ButtonProps,
	"variant" | "children" | "icon" | "aria-label"
> &
	RefAttributes<HTMLButtonElement> & {
		/** The accessible name and tooltip (default "Settings"). */
		label?: string;
	};

/** The settings control: an icon button with a tooltip. */
export function SettingsButton({
	label = uiStrings.settings.open,
	...props
}: SettingsButtonProps) {
	return (
		<Tooltip content={label} placement="bottom">
			<IconButton
				data-slot="settings-button"
				aria-label={label}
				icon={<SettingsIcon aria-hidden="true" />}
				{...props}
			/>
		</Tooltip>
	);
}
