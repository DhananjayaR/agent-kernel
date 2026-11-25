// Switch (the "Toggle" of the component list): turns a setting on or off (a boolean config field). Added with
// the shadcn CLI (aria-nova, React Aria `Switch`), restyled: a 28 x 16 pill track with a 2 px control border;
// on fills with the primary (selection) colour and moves the thumb, so the state is never colour alone.
import type { ReactNode } from "react";
import {
	Switch as AriaSwitch,
	type SwitchProps as AriaSwitchProps,
} from "react-aria-components";
import { motion } from "../lib/styles";
import { cn } from "../lib/utils";

export type SwitchProps = Omit<AriaSwitchProps, "children" | "className"> & {
	/** The label, next to the track. */
	children: ReactNode;
	className?: string;
};

export function Switch({ children, className, ...props }: SwitchProps) {
	return (
		<AriaSwitch
			data-slot="switch"
			className={cn(
				"group/switch flex min-h-control-m cursor-default items-center gap-2 text-ui text-text select-none",
				"data-disabled:text-disabled-text",
				className,
			)}
			{...props}
		>
			<span
				data-slot="switch-track"
				aria-hidden="true"
				className={cn(
					"flex h-4 w-7 shrink-0 items-center rounded-pill border-2 border-border-control p-0.5",
					motion,
					"group-data-hovered/switch:border-text-muted",
					"group-data-selected/switch:border-accent-primary group-data-selected/switch:bg-accent-primary",
					"group-data-selected/switch:group-data-hovered/switch:border-accent-primary-hover group-data-selected/switch:group-data-hovered/switch:bg-accent-primary-hover",
					"group-data-disabled/switch:border-disabled-border group-data-disabled/switch:bg-disabled-fill",
					"group-data-focus-visible/switch:focus-outline",
				)}
			>
				<span
					className={cn(
						"size-2 rounded-pill bg-text-muted",
						motion,
						"group-data-selected/switch:translate-x-3 group-data-selected/switch:bg-on-accent-primary",
						"group-data-disabled/switch:bg-disabled-text",
					)}
				/>
			</span>
			{children}
		</AriaSwitch>
	);
}
