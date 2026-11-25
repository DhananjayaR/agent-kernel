// Switch (the "Toggle" of the component list): turns a setting on or off (a boolean config field). Added with
// the shadcn CLI (aria-nova, React Aria `Switch`), restyled: a 28 x 16 pill track with a 2 px border. On fills
// with the primary (selection) colour, draws its edge in text-accent-primary (at least 3:1 on every surface) and
// moves the thumb, so the state is never colour alone. Read-only does not change on hover or press. State colours
// and their precedence: `toggleIndicatorColours` and `switchThumbColour` (lib/state.ts).
import type { ReactNode } from "react";
import {
	Switch as AriaSwitch,
	type SwitchProps as AriaSwitchProps,
} from "react-aria-components";
import {
	switchThumbColour,
	toggleIndicatorColours,
	toggleLabelColour,
} from "../lib/state";
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
			className={({ isDisabled }) =>
				cn(
					"group/switch flex min-h-control-m cursor-default items-center gap-2 text-ui select-none",
					toggleLabelColour({ disabled: isDisabled }),
					className,
				)
			}
			{...props}
		>
			{({
				isSelected,
				isHovered,
				isPressed,
				isDisabled,
				isReadOnly,
				isFocusVisible,
			}) => (
				<>
					<span
						data-slot="switch-track"
						aria-hidden="true"
						className={cn(
							"flex h-4 w-7 shrink-0 items-center rounded-pill border-2 p-0.5",
							motion,
							toggleIndicatorColours({
								selected: isSelected,
								hovered: isHovered,
								pressed: isPressed,
								disabled: isDisabled,
								readOnly: isReadOnly,
							}),
							isFocusVisible && "focus-outline",
						)}
					>
						<span
							className={cn(
								"size-2 rounded-pill",
								motion,
								isSelected && "translate-x-3",
								switchThumbColour({
									selected: isSelected,
									disabled: isDisabled,
								}),
							)}
						/>
					</span>
					{children}
				</>
			)}
		</AriaSwitch>
	);
}
