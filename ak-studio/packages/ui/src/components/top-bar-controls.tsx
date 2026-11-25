// The top bar's controls after the tabs: RunControl (the local run, a session control: state, start and stop, the
// port, a link to its log), DeployStatus (whether the project is deployed), BuildWithAIButton (the AI button
// style) and SettingsButton. States are StatusChips (icon and label, never colour alone). In the compact top bar
// (narrower than 1100 px) the run control drops the port and the deploy status its time; Build with AI keeps its
// sparkle and its name, shown in a tooltip.
//
// Presentational: the local run arrives in P8 and deploying in P10; until then the renderer does not show them
// (a project-scoped control has nothing to act on while no project is open).
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

export type RunState = "stopped" | "starting" | "running" | "failed";

const RUN_STATUS: Record<RunState, Status> = {
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

/** The local run: its state, start or stop, and (when it failed) a way to its log. */
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
			{live ? (
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
	const button = (
		<Button
			data-slot="build-with-ai"
			variant="ai"
			icon={<SparklesIcon aria-hidden="true" />}
			className={cn(compact && "gap-0 px-1.5", className)}
			{...props}
		>
			<span className={cn(compact && "sr-only")}>{label}</span>
		</Button>
	);
	return compact ? (
		<Tooltip content={label} placement="bottom">
			{button}
		</Tooltip>
	) : (
		button
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
