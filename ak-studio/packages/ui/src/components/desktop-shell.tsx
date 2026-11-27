// DesktopShell: the frame around every screen inside a project (the "shell and tabs" pattern; no left
// navigation). From top to bottom: the TopBar (the OAK mark, the project switcher, the five app tabs, then the run
// control, deploy status, Build with AI and settings), the selected tab's content, the collapsible BottomPanel (Problems, Run log,
// Commands) and the StatusBar. Presentational: everything it shows comes in through props and slots; the renderer
// owns the data, the route and the stored layout.
//
// Layout: one 48 px top bar row. The project name shrinks first (down to 96 px, with an ellipsis; the full name and
// path stay in its tooltip and menu), the tabs never shrink, and the controls keep their labels; at 1220 px and
// wider every label is shown in full (stories `At1220`, `At1440`; at 1220 px the worst case leaves the project 8 px
// above its minimum, after the OAK mark, with the 120 px window controls counted). Narrower than that (the window
// allows 1000 px; at 1100 px the bar is compact, story `At1100`), or when the full form does not fit even so
// (badges on the tabs, a longer label; story `At1220WithBadges`), the top bar is compact (`TOP_BAR_COMPACT_BELOW`,
// story `At1000Compact`): the tabs sit 16 px apart instead of 24 and the bar's parts 8 px instead of 12, Build with AI shows its sparkle only (its name in a
// tooltip), the run control drops the port, and the deploy status drops its time. Compact because it overflowed,
// it tries the full form again when the tabs change (a badge goes) or the bar widens (story `BadgesComeAndGo`).
// Changing form never remounts a control, so focus stays where it was. Nothing scrolls sideways at any width
// (asserted by the stories).
//
// Window chrome (the window has no system title bar): the top bar is the window's drag region (`app-drag`; empty
// space between the parts drags, and every interactive part inside opts out with `app-no-drag`). `windowControls`
// (the WindowControls, Linux and Windows) sits flush at the bar's far right, 120 px wide, and `leadingInset` (px,
// macOS: about 76 for the traffic lights) reserves room at its left. The controls' 120 px count in the widths above.
//
// Tabs: React Aria tabs (the Tabs keyboard model: arrows move and select, Home and End, Tab leaves the list to the
// panel). `tabs` gives their ids and labels (the app builds them from its feature manifests); omitted, they are the
// five app tabs, `APP_TABS`, with the default labels. The panel area is the `main` landmark. Panel sizes: the bottom panel's height is in pixels, restored from
// `bottomPanelLayout` when the shell mounts (mount it once the stored layout is known) and reported through
// `onBottomPanelLayoutChange` after the person drags the handle, uses its keys, or toggles the panel. Collapsing
// keeps the panel's tab strip in place, so its toggle never moves and focus has somewhere to stay.
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import type { Key } from "react-aria-components";
import oakMark from "../assets/oak-mark-orange.svg";
import { cn } from "../lib/utils";
import {
	type BottomPanelStrings,
	type ShellStrings,
	uiStrings,
} from "../strings";
import {
	ResizableHandle,
	ResizablePanel,
	type ResizablePanelHandle,
	ResizablePanels,
} from "./resizable-panels";
import { Tab, TabList, TabPanel, Tabs } from "./tabs";

/** The app areas, in order. */
export const APP_TABS = [
	"canvas",
	"code",
	"config",
	"test-trace",
	"deploy",
] as const;
export type AppTabId = (typeof APP_TABS)[number];

const TAB_LABELS: Record<AppTabId, keyof ShellStrings> = {
	canvas: "canvas",
	code: "code",
	config: "config",
	"test-trace": "testTrace",
	deploy: "deploy",
};

export function isAppTabId(value: unknown): value is AppTabId {
	return (APP_TABS as readonly unknown[]).includes(value);
}

/** One app tab: its id (React Aria's key, so the tab and its panel's ids) and its label. */
export type DesktopShellTab<T extends string = string> = {
	id: T;
	label: string;
};

/** The five app tabs with the default labels (strings.ts), in order. */
function defaultTabs(text: ShellStrings): DesktopShellTab<AppTabId>[] {
	return APP_TABS.map((id) => ({ id, label: text[TAB_LABELS[id]] }));
}

/**
 * Below this top bar width (CSS pixels) the top bar is compact. At 1220 px every label shows in full (with the
 * window controls; it was 1100 px before them); wider, it is compact only if the full form overflows.
 */
export const TOP_BAR_COMPACT_BELOW = 1220;

const CompactContext = createContext(false);

/** True while the top bar is narrower than `TOP_BAR_COMPACT_BELOW`: controls show their short form. */
export function useTopBarCompact(): boolean {
	return useContext(CompactContext);
}

/** The bottom panel's height while collapsed: its tab strip (the 48 px tab height). */
export const BOTTOM_PANEL_COLLAPSED_HEIGHT = 48;
/** The smallest open height; the contract's `BOTTOM_PANEL_HEIGHT.min` (a renderer test keeps them equal). */
export const BOTTOM_PANEL_MIN_HEIGHT = 120;
/**
 * The largest height the app stores; the contract's `BOTTOM_PANEL_HEIGHT.max` (a renderer test keeps them equal).
 * A taller panel (a tall display, zoomed out) is reported at this height rather than refused by the contract.
 */
export const BOTTOM_PANEL_MAX_HEIGHT = 4000;
/** The tab content keeps at least this much height when the bottom panel is dragged up. */
export const MAIN_MIN_HEIGHT = 160;

/** The bottom panel's remembered state (the contract's `ShellLayout["bottomPanel"]`). */
export type BottomPanelLayout = { open: boolean; height: number };

export type TopBarProps = {
	/** The ProjectSwitcher. */
	project: ReactNode;
	/** The AppTabList. */
	tabs: ReactNode;
	/** RunControl, DeployStatus, Build with AI and the settings control, in that order. */
	actions?: ReactNode;
	/** The WindowControls, flush with the bar's right edge, after `actions`. Omit where the system draws them. */
	windowControls?: ReactNode;
	/** Space (px) kept free at the bar's left edge, for the macOS traffic lights (about 76). Default: none. */
	leadingInset?: number;
	/** Overrides of the default copy (strings.ts): `appName`, the mark's accessible name. */
	strings?: Partial<ShellStrings>;
	className?: string;
};

/**
 * The 48 px top bar (the `banner` landmark). Measures its own width to switch to the compact form. It starts with
 * the OAK mark (branding/logo-mark/oak-mark-orange.svg, copied byte for byte into src/assets/ and imported as an
 * asset, never redrawn), 20 px, named "OAK Studio": the app's name in the banner.
 */
export function TopBar({
	project,
	tabs,
	actions,
	windowControls,
	leadingInset,
	strings,
	className,
}: TopBarProps) {
	const text = { ...uiStrings.shell, ...strings };
	const ref = useRef<HTMLElement>(null);
	const [compact, setCompact] = useState(false);
	// When the full top bar last overflowed: the bar's width and the tabs' text (labels and badges) then.
	const overflowed = useRef<{ width: number; tabs: string } | null>(null);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		const tabsText = () =>
			el.querySelector('[role="tablist"]')?.textContent ?? "";
		const measure = () => {
			const width = el.getBoundingClientRect().width;
			setCompact((was) => {
				if (width < TOP_BAR_COMPACT_BELOW) return true;
				if (!was) {
					// Compact as well when the full form does not fit, even at 1220 px or wider.
					if (el.scrollWidth <= el.clientWidth) return false;
					overflowed.current = { width, tabs: tabsText() };
					return true;
				}
				// Compact because it overflowed: try the full form again once the bar is wider than then, or the
				// tabs changed (a badge went away). If it still does not fit, the next measure turns it compact
				// again and records the new state, so it settles after one try (no flip-flop).
				const last = overflowed.current;
				if (!last || width > last.width || tabsText() !== last.tabs) {
					overflowed.current = null;
					return false;
				}
				return true;
			});
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		// Content changes too (a badge appears): the parts resize.
		for (const child of el.children) observer.observe(child);
		return () => observer.disconnect();
	}, []);
	return (
		<CompactContext.Provider value={compact}>
			<header
				ref={ref}
				data-slot="top-bar"
				data-compact={compact || undefined}
				style={leadingInset ? { paddingInlineStart: leadingInset } : undefined}
				className={cn(
					"app-drag flex h-topbar w-full min-w-0 shrink-0 items-center gap-3 border-b border-border-default bg-surface-raised ps-2 pe-3",
					// Everything the person can press or type in stays out of the drag region.
					"[&_:is(a,button,input,select,textarea,[role=tab],[role=button])]:app-no-drag",
					windowControls && "pe-0",
					compact && "gap-2",
					className,
				)}
			>
				{/* The mark (20 px) and a 6 px gap, then the switcher between 96 and 256 px wide. */}
				<div className="flex min-w-30.5 max-w-70.5 shrink items-center gap-text-to-visual">
					<img
						src={oakMark}
						alt={text.appName}
						width={20}
						height={20}
						draggable={false}
						data-slot="top-bar-mark"
						className="size-5 shrink-0"
					/>
					<div className="flex min-w-0 flex-1 items-center">{project}</div>
				</div>
				<div className="flex h-full shrink-0 items-end">{tabs}</div>
				{actions ? (
					<div className="ms-auto flex shrink-0 items-center gap-3">
						{actions}
					</div>
				) : null}
				{windowControls ? (
					<div
						data-slot="top-bar-window-controls"
						className={cn("flex h-full shrink-0", !actions && "ms-auto")}
					>
						{windowControls}
					</div>
				) : null}
			</header>
		</CompactContext.Provider>
	);
}

export type AppTabListProps = {
	/** The tabs, in order; omitted, the five app tabs (Canvas, Code, Config, Test & trace, Deploy). */
	tabs?: readonly DesktopShellTab[];
	/** The background job notice after a tab's label (a JobTabIcon: a state icon, not a count), by tab id. */
	badges?: Partial<Record<string, ReactNode>>;
	/** Overrides of the default copy (strings.ts). */
	strings?: Partial<ShellStrings>;
};

/** The app tabs (by default Canvas, Code, Config, Test & trace and Deploy), filling the top bar's height. */
export function AppTabList({ tabs, badges, strings }: AppTabListProps) {
	const text = { ...uiStrings.shell, ...strings };
	const compact = useTopBarCompact();
	return (
		<TabList
			aria-label={text.tabsLabel}
			className={cn("h-full border-b-0", compact && "gap-4")}
		>
			{(tabs ?? defaultTabs(text)).map(({ id, label }) => (
				<Tab key={id} id={id}>
					{label}
					{badges?.[id] ?? null}
				</Tab>
			))}
		</TabList>
	);
}

function clampHeight(px: number): number {
	return Math.min(
		BOTTOM_PANEL_MAX_HEIGHT,
		Math.max(BOTTOM_PANEL_MIN_HEIGHT, Math.round(px)),
	);
}

/** The tab content above the bottom panel, with the handle between them. */
function ShellPanels({
	main,
	bottomPanel,
	layout,
	onLayoutChange,
	resizeLabel,
}: {
	main: ReactNode;
	bottomPanel: ReactNode;
	layout: BottomPanelLayout;
	onLayoutChange?: (layout: BottomPanelLayout) => void;
	resizeLabel: string;
}) {
	const panelRef = useRef<ResizablePanelHandle>(null);
	const layoutRef = useRef(layout);
	layoutRef.current = layout;
	// Bring the panel in line when the open state comes in from outside (toggle, shortcut). The library keeps its
	// own size; this only acts when it disagrees with `layout`. An effect, not a layout effect: the group registers
	// its panels in its own layout effects, which run after its children's.
	useEffect(() => {
		const panel = panelRef.current;
		if (!panel) return;
		if (!layout.open) {
			if (!panel.isCollapsed()) panel.collapse();
		} else if (panel.isCollapsed()) {
			panel.resize(layout.height);
		}
	}, [layout.open, layout.height]);
	return (
		<ResizablePanels
			id="desktop-shell"
			orientation="vertical"
			onLayoutChange={() => {
				// After the person dragged the handle or used its keys: report the open state and, while open, the
				// height. A collapsed panel keeps the remembered height, so opening it restores that. Read on the next
				// frame: the library reports the change before the panel has its new size.
				requestAnimationFrame(() => {
					const panel = panelRef.current;
					const current = layoutRef.current;
					if (!panel || !onLayoutChange) return;
					const open = !panel.isCollapsed();
					const height = open
						? clampHeight(panel.getSize().inPixels)
						: current.height;
					if (open !== current.open || height !== current.height)
						onLayoutChange({ open, height });
				});
			}}
		>
			<ResizablePanel id="main" minSize={MAIN_MIN_HEIGHT}>
				{main}
			</ResizablePanel>
			<ResizableHandle aria-label={resizeLabel} />
			<ResizablePanel
				id="bottom-panel"
				panelRef={panelRef}
				collapsible
				collapsedSize={BOTTOM_PANEL_COLLAPSED_HEIGHT}
				minSize={BOTTOM_PANEL_MIN_HEIGHT}
				defaultSize={
					layout.open ? layout.height : BOTTOM_PANEL_COLLAPSED_HEIGHT
				}
				className="overflow-hidden"
			>
				{bottomPanel}
			</ResizablePanel>
		</ResizablePanels>
	);
}

/**
 * Renders its children only once its own element is in a window. React Aria's Tabs first renders everything inside
 * it into a detached document to build its collection (react-aria 3.53.1, `CollectionBuilder`); the panel group
 * of react-resizable-panels refuses to mount there ("Cannot register an unmounted Group"). The real render follows
 * in the same commit, before paint. Depends on react-aria 3.53.1 internals (shipped with react-aria-components
 * 1.22.1, pinned): check it again on any upgrade (the stories fail if the group mounts in the detached pass).
 */
function InWindow({
	className,
	children,
}: {
	className: string;
	children: ReactNode;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const [inWindow, setInWindow] = useState(false);
	useLayoutEffect(() => {
		if (ref.current?.ownerDocument.defaultView) setInWindow(true);
	}, []);
	return (
		<div ref={ref} className={className}>
			{inWindow ? children : null}
		</div>
	);
}

export type DesktopShellProps<T extends string = AppTabId> = {
	/** The app tabs, in order (ids and labels); omitted, the five app tabs with the default labels. */
	tabs?: readonly DesktopShellTab<T>[];
	/** The selected app tab (from the route). */
	selectedTab: T;
	onTabChange: (tab: T) => void;
	/** The ProjectSwitcher. */
	project: ReactNode;
	/** The top bar's controls after the tabs: RunControl, DeployStatus, Build with AI, the settings control. */
	actions?: ReactNode;
	/** The WindowControls, at the top bar's far right (Linux and Windows); omit where the system draws them. */
	windowControls?: ReactNode;
	/** Space (px) kept free at the top bar's left for the macOS traffic lights (about 76); default none. */
	leadingInset?: number;
	/** The background job notice after a tab's label (a JobTabIcon: a state icon, not a count), by tab. */
	tabBadges?: Partial<Record<T, ReactNode>>;
	/** The BottomPanel; omitted, the tab content takes the whole height. */
	bottomPanel?: ReactNode;
	/** The bottom panel's open state and height, read when the shell mounts and kept in step after. */
	bottomPanelLayout?: BottomPanelLayout;
	/** Called with the layout to remember after the person resizes or collapses the panel with its handle. */
	onBottomPanelLayoutChange?: (layout: BottomPanelLayout) => void;
	/** The StatusBar. */
	statusBar?: ReactNode;
	/** The selected tab's content. */
	children: ReactNode;
	/** Overrides of the default copy (strings.ts). */
	strings?: Partial<ShellStrings>;
	bottomPanelStrings?: Partial<BottomPanelStrings>;
	className?: string;
};

export function DesktopShell<T extends string = AppTabId>({
	tabs,
	selectedTab,
	onTabChange,
	project,
	actions,
	windowControls,
	leadingInset,
	tabBadges,
	bottomPanel,
	bottomPanelLayout = { open: true, height: 240 },
	onBottomPanelLayoutChange,
	statusBar,
	children,
	strings,
	bottomPanelStrings,
	className,
}: DesktopShellProps<T>) {
	const shellTabs =
		tabs ??
		(defaultTabs({
			...uiStrings.shell,
			...strings,
		}) as unknown as readonly DesktopShellTab<T>[]);
	const main = (
		<main className="size-full min-h-0">
			{/* One panel, for the selected tab; keyed so React Aria gives it that tab's id and label. */}
			<TabPanel
				key={selectedTab}
				id={selectedTab}
				className="relative size-full overflow-auto rounded-none pt-0"
			>
				{children}
			</TabPanel>
		</main>
	);
	return (
		<div
			data-slot="desktop-shell"
			className={cn(
				"relative flex h-dvh w-full min-w-0 flex-col overflow-hidden bg-surface text-text",
				className,
			)}
		>
			<Tabs
				selectedKey={selectedTab}
				onSelectionChange={(key: Key) => {
					const tab = shellTabs.find((t) => t.id === key);
					if (tab) onTabChange(tab.id);
				}}
				className="min-h-0 flex-1"
			>
				<TopBar
					project={project}
					strings={strings}
					tabs={
						<AppTabList
							tabs={shellTabs}
							badges={tabBadges as Partial<Record<string, ReactNode>>}
							strings={strings}
						/>
					}
					actions={actions}
					windowControls={windowControls}
					leadingInset={leadingInset}
				/>
				<InWindow className="min-h-0 flex-1">
					{bottomPanel ? (
						<ShellPanels
							main={main}
							bottomPanel={bottomPanel}
							layout={bottomPanelLayout}
							onLayoutChange={onBottomPanelLayoutChange}
							resizeLabel={
								bottomPanelStrings?.resize ?? uiStrings.bottomPanel.resize
							}
						/>
					) : (
						main
					)}
				</InWindow>
			</Tabs>
			{statusBar}
		</div>
	);
}
