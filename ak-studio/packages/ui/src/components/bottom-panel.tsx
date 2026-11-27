// BottomPanel: the collapsible panel under the tab content, with three views: Problems (validation and files the
// app cannot read), Run log (the local run's output) and Commands (every command the app or the coding agent ran).
// It goes in DesktopShell's `bottomPanel` slot, which sizes it; this component draws its tab strip, the show/hide
// toggle and the selected view. Collapsed, only the tab strip shows (the 48 px tabs), so the toggle stays where it
// was and the views remain one press away.
//
// Keyboard: the panel's tabs follow the Tabs model (arrows move and select, Home and End, Tab moves on to the view).
// Selecting a tab while the panel is collapsed opens it. While collapsed the views are inert (out of the tab order
// and hidden from assistive technology). Hiding the panel never loses focus: if focus was inside a view, it moves
// to the toggle first, whether the toggle hid it or the open state changed from outside.
//
// Presentational: the panel has no shortcut of its own. The app's command shell.toggleBottomPanel (Mod+J, declared
// in the shell's manifest, P1b-plan ruling 13) changes `isOpen` from outside; the app passes that shortcut as shown
// (`strings.shortcut`, for the toggle's tooltip) and in aria-keyshortcuts form (`keyShortcuts`).
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { type ReactNode, useCallback, useLayoutEffect, useRef } from "react";
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
	/** Overrides of the default copy (strings.ts); `shortcut` is the app's show/hide shortcut as shown ("⌘J" on macOS). */
	strings?: Partial<BottomPanelStrings>;
	/**
	 * That shortcut in aria-keyshortcuts form ("Meta+J" on macOS, "Control+J" elsewhere), set on the toggle. React
	 * Aria's Button does not pass aria-keyshortcuts through, so it is set on the element directly.
	 */
	keyShortcuts?: string;
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
	keyShortcuts,
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

	// After every render: the toggle element is React Aria's, and nothing else keeps the attribute on it.
	useLayoutEffect(() => {
		const toggle = toggleRef.current;
		if (!toggle) return;
		if (keyShortcuts) toggle.setAttribute("aria-keyshortcuts", keyShortcuts);
		else toggle.removeAttribute("aria-keyshortcuts");
	});

	const content: Record<BottomPanelTabId, ReactNode> = {
		problems,
		"run-log": runLog,
		commands,
	};
	const toggleLabel = isOpen ? text.hide : text.show;
	return (
		// The panel usually sits inside the app's Tabs (DesktopShell). Its own Tabs must not see that outer tab state:
		// React Aria's collection pass would render this TabList against it and change the app tabs' ids (React Aria
		// clears these contexts the same way inside a TabPanel). Depends on react-aria 3.53.1 internals (the collection
		// pass, react-aria-components 1.22.1 pinned): check it again on any upgrade (axe's aria-controls check and the
		// shell stories catch a regression).
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
								aria-expanded={isOpen}
								icon={
									isOpen ? (
										<IconChevronDown aria-hidden="true" />
									) : (
										<IconChevronUp aria-hidden="true" />
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
						// Closed, the strip leaves this area no height: it must not scroll, or a stub scroll bar shows.
						className={cn(
							"relative min-h-0 flex-1 border-t border-border-default",
							isOpen ? "overflow-auto" : "overflow-hidden",
						)}
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
