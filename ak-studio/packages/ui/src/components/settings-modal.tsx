// SettingsModal: the app's settings, opened from the settings control at the end of the top bar. A Modal (focus
// moves in, Escape or the close button closes it, focus returns to the control). In P1a it holds one setting, the
// theme (System, Dark, Light); a change applies and is stored at once, so there is no save button. P4 adds the
// toolchain, secrets and general sections.
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useId } from "react";
import type { Key } from "react-aria-components";
import { fieldDescription } from "../lib/styles";
import { type SettingsStrings, uiStrings } from "../strings";
import { InlineBanner } from "./inline-banner";
import { Modal } from "./modal";
import { SegmentedControl, SegmentedControlItem } from "./segmented-control";

/** The stored theme preference (the contract's `ThemePreference`). */
export type ThemeChoice = "system" | "dark" | "light";

const THEMES: readonly ThemeChoice[] = ["system", "dark", "light"];

function isThemeChoice(key: Key): key is ThemeChoice {
	return (THEMES as readonly Key[]).includes(key);
}

export type SettingsModalProps = {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	theme: ThemeChoice;
	onThemeChange: (theme: ThemeChoice) => void;
	/** Why the last change could not be stored, and what to do next. */
	error?: { title: string; description?: string };
	/** Overrides of the default copy (strings.ts). */
	strings?: Partial<SettingsStrings>;
};

export function SettingsModal({
	isOpen,
	onOpenChange,
	theme,
	onThemeChange,
	error,
	strings,
}: SettingsModalProps) {
	const text = { ...uiStrings.settings, ...strings };
	const labelId = useId();
	const helpId = useId();
	return (
		<Modal isOpen={isOpen} onOpenChange={onOpenChange} title={text.title}>
			<div data-slot="settings" className="flex flex-col gap-4 pb-1">
				<div className="flex flex-col gap-2">
					<span id={labelId} className="text-ui font-action text-text">
						{text.theme}
					</span>
					<SegmentedControl
						aria-labelledby={labelId}
						aria-describedby={helpId}
						selectedKey={theme}
						onSelectionChange={(key) => {
							if (isThemeChoice(key) && key !== theme) onThemeChange(key);
						}}
						className="self-start"
					>
						<SegmentedControlItem
							id="system"
							icon={<MonitorIcon aria-hidden="true" />}
						>
							{text.system}
						</SegmentedControlItem>
						<SegmentedControlItem
							id="dark"
							icon={<MoonIcon aria-hidden="true" />}
						>
							{text.dark}
						</SegmentedControlItem>
						<SegmentedControlItem
							id="light"
							icon={<SunIcon aria-hidden="true" />}
						>
							{text.light}
						</SegmentedControlItem>
					</SegmentedControl>
					<p id={helpId} className={fieldDescription}>
						{text.themeHelp}
					</p>
				</div>
				{error ? (
					<InlineBanner tone="danger" title={error.title}>
						{error.description}
					</InlineBanner>
				) : null}
			</div>
		</Modal>
	);
}
