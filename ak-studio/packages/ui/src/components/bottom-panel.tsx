// BottomPanel: the collapsible panel under the tab content, with three views: Problems (validation and files the
// app cannot read), Run log (the local run's output) and Commands (every command the app or the coding agent ran).
// It goes in DesktopShell's `bottomPanel` slot, which sizes it; this component draws its tab strip, the show/hide
// toggle and the selected view. Collapsed, only the tab strip shows (the 48 px tabs), so the toggle stays where it
// was and the views remain one press away.
//
// Keyboard: the panel's tabs follow the Tabs model (arrows move and select, Home and End, Tab moves on to the view).
// Selecting a tab while the panel is collapsed opens it. Mod+J (Ctrl+J; Cmd+J on macOS) shows or hides the panel
// from anywhere in the window (`BOTTOM_PANEL_SHORTCUT`); the toggle's tooltip shows it. While collapsed the views
// are inert (out of the tab order and hidden from assistive technology). Hiding the panel never loses focus: if
// focus was inside a view, it moves to the toggle first.
//
// Declared shortcut (P1a has no shortcut registry or clash test yet; P1b's feature manifests take it over):
//   Mod+J  Show or hide the bottom panel. Not used by the app menu (reload, zoom, full screen, edit roles),
//          React Aria (F6, Shift+F10) or the browser in Electron.
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
} from "react";
import {
	type Key,
	Provider,
	TabListStateContext,
	TabsContext,
} from "react-aria-components";
import { cn } from "../lib/utils";
import { type BottomPanelStrings, uiStrings } from "../strings";
import { IconButton } from "./button";
import { Tab, TabList, TabPanel, Tabs } from "./tabs";
import { Tooltip } from "./tooltip";

export const BOTTOM_PANEL_TABS = ["problems", "run-log", "commands"] as const;
export type BottomPanelTabId = (typeof BOTTOM_PANEL_TABS)[number];

const TAB_LABELS: Record<BottomPanelTabId, keyof BottomPanelStrings> = {
	problems: "problems",
	"run-log": "runLog",
	commands: "commands",
};

/** The panel's show/hide shortcut: Mod+J (Ctrl or Cmd, no Shift or Alt). */
export const BOTTOM_PANEL_SHORTCUT = { key: "j", mod: true } as const;

/** True for the keydown of `BOTTOM_PANEL_SHORTCUT`. */
export function isBottomPanelShortcut(
	e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">,
): boolean {
	return (
		e.key.toLowerCase() === BOTTOM_PANEL_SHORTCUT.key &&
		(e.ctrlKey || e.metaKey) &&
		!e.altKey &&
		!e.shiftKey
	);
}

export type BottomPanelProps = {
	/** Open (its view shows) or collapsed (only the tab strip). */
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	selectedTab: BottomPanelTabId;
	onTabChange: (tab: BottomPanelTabId) => void;
	/** The views' content. */
	problems: ReactNode;
	runLog: ReactNode;
	commands: ReactNode;
	/** A Badge after a tab's label (the number of problems), by tab. */
	badges?: Partial<Record<BottomPanelTabId, ReactNode>>;
	/** Overrides of the default copy (strings.ts); `shortcut` is the shortcut as shown ("⌘J" on macOS). */
	strings?: Partial<BottomPanelStrings>;
	className?: string;
};

export function BottomPanel({
	isOpen,
	onOpenChange,
	selectedTab,
	onTabChange,
	problems,
	runLog,
	commands,
	badges,
	strings,
	className,
}: BottomPanelProps) {
	const text = { ...uiStrings.bottomPanel, ...strings };
	const toggleRef = useRef<HTMLButtonElement>(null);
	const viewsRef = useRef<HTMLDivElement>(null);

	/** Hides the panel, first moving focus out of the views (they become inert). */
	const setOpen = useCallback(
		(open: boolean) => {
			if (!open && viewsRef.current?.contains(document.activeElement))
				toggleRef.current?.focus();
			onOpenChange(open);
		},
		[onOpenChange],
	);

	// The open state can also change from outside (the handle, a restored layout): never leave focus inside an
	// inert view. Runs before the browser applies `inert`'s focus fix-up.
	useLayoutEffect(() => {
		if (!isOpen && viewsRef.current?.contains(document.activeElement))
			toggleRef.current?.focus();
	}, [isOpen]);

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.defaultPrevented || e.repeat || !isBottomPanelShortcut(e)) return;
			e.preventDefault();
			setOpen(!isOpen);
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [isOpen, setOpen]);

	const content: Record<BottomPanelTabId, ReactNode> = {
		problems,
		"run-log": runLog,
		commands,
	};
	const toggleLabel = isOpen ? text.hide : text.show;
	return (
		// The panel usually sits inside the app's Tabs (DesktopShell). Its own Tabs must not see that outer tab state:
		// React Aria's collection pass would render this TabList against it and change the app tabs' ids (React Aria
		// clears these contexts the same way inside a TabPanel).
		<Provider
			values={[
				[TabsContext, null],
				[TabListStateContext, null],
			]}
		>
			<section
				data-slot="bottom-panel"
				data-open={isOpen || undefined}
				aria-label={text.label}
				className={cn("flex size-full flex-col bg-surface-raised", className)}
			>
				<Tabs
					selectedKey={selectedTab}
					onSelectionChange={(key: Key) => {
						const tab = BOTTOM_PANEL_TABS.find((t) => t === key);
						if (!tab) return;
						onTabChange(tab);
						if (!isOpen) setOpen(true);
					}}
					className="min-h-0 flex-1"
				>
					<div className="flex h-tab shrink-0 items-center gap-2 ps-3 pe-2">
						<TabList aria-label={text.tabsLabel} className="h-full border-b-0">
							{BOTTOM_PANEL_TABS.map((id) => (
								<Tab key={id} id={id}>
									{text[TAB_LABELS[id]]}
									{badges?.[id] ?? null}
								</Tab>
							))}
						</TabList>
						<Tooltip
							content={`${toggleLabel} (${text.shortcut})`}
							placement="top"
						>
							<IconButton
								ref={toggleRef}
								data-slot="bottom-panel-toggle"
								aria-label={toggleLabel}
								aria-keyshortcuts="Control+J Meta+J"
								aria-expanded={isOpen}
								icon={
									isOpen ? (
										<ChevronDownIcon aria-hidden="true" />
									) : (
										<ChevronUpIcon aria-hidden="true" />
									)
								}
								className="ms-auto"
								onPress={() => setOpen(!isOpen)}
							/>
						</Tooltip>
					</div>
					<div
						ref={viewsRef}
						inert={!isOpen}
						className="min-h-0 flex-1 overflow-auto border-t border-border-default"
					>
						<TabPanel
							key={selectedTab}
							id={selectedTab}
							className="min-h-full rounded-none pt-0"
						>
							{content[selectedTab]}
						</TabPanel>
					</div>
				</Tabs>
			</section>
		</Provider>
	);
}
