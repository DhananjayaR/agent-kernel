// WindowControls: minimise, maximise (restore while maximised) and close, at the far right of the top bar, for a
// window without a system title bar (Linux and Windows; macOS keeps its own traffic lights). Presentational: the
// renderer wires the three handlers to the bridge and passes the window's maximised state.
// Each button is 40 px wide and the top bar's full 48 px tall, with square corners: they sit against the window's
// edge, where a rounded corner would show a gap (a recorded exception to the 8 px control radius, conventions-and-
// skills.md, visual rules). Quiet until hovered; Close fills with the danger colour. They opt out of the top bar's
// drag region (`app-no-drag`), or a press would start a window drag instead of a click.
import { IconMinus, IconSquare, IconSquares, IconX } from "@tabler/icons-react";
import type { ReactElement } from "react";
import { Button as AriaButton, Group } from "react-aria-components";
import { motion } from "../lib/styles";
import { cn } from "../lib/utils";
import { uiStrings, type WindowControlsStrings } from "../strings";

export type WindowControlsProps = {
	/** Whether the window is maximised: the middle button then restores it. */
	maximized: boolean;
	onMinimize: () => void;
	onToggleMaximize: () => void;
	onClose: () => void;
	/** Overrides of the default copy (strings.ts). */
	strings?: Partial<WindowControlsStrings>;
	className?: string;
};

const buttonClass = [
	"app-no-drag focus-ring-inset flex h-full w-10 shrink-0 cursor-default items-center justify-center rounded-none",
	"border-0 bg-transparent text-text outline-none select-none",
	"data-hovered:bg-fill data-pressed:bg-fill-hover",
	"[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
	motion,
].join(" ");

const closeClass =
	"data-hovered:bg-status-danger data-hovered:text-on-status-danger data-pressed:bg-status-danger-hover data-pressed:text-on-status-danger";

function WindowButton({
	slot,
	label,
	icon,
	onPress,
	className,
}: {
	slot: string;
	label: string;
	icon: ReactElement;
	onPress: () => void;
	className?: string;
}) {
	return (
		<AriaButton
			data-slot={slot}
			aria-label={label}
			onPress={onPress}
			className={cn(buttonClass, className)}
		>
			{icon}
		</AriaButton>
	);
}

export function WindowControls({
	maximized,
	onMinimize,
	onToggleMaximize,
	onClose,
	strings,
	className,
}: WindowControlsProps) {
	const text = { ...uiStrings.windowControls, ...strings };
	return (
		<Group
			aria-label={text.group}
			data-slot="window-controls"
			data-maximized={maximized || undefined}
			className={cn("flex h-full shrink-0 items-stretch", className)}
		>
			<WindowButton
				slot="window-minimize"
				label={text.minimise}
				icon={<IconMinus aria-hidden="true" />}
				onPress={onMinimize}
			/>
			<WindowButton
				slot="window-maximize"
				label={maximized ? text.restore : text.maximise}
				icon={
					maximized ? (
						<IconSquares aria-hidden="true" />
					) : (
						<IconSquare aria-hidden="true" />
					)
				}
				onPress={onToggleMaximize}
			/>
			<WindowButton
				slot="window-close"
				label={text.close}
				icon={<IconX aria-hidden="true" />}
				onPress={onClose}
				className={closeClass}
			/>
		</Group>
	);
}
