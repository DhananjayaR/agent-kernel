// The desktop shell in the app: the design system's DesktopShell wired to the bridge. Real data where it exists in
// P1a: the window controls (Linux, Windows and the browser; macOS keeps its own), the Studio's version (status bar),
// the theme preference (settings) and the remembered panel layout (an app preference, stored by main through
// `app.setLayout`). No project can be opened before P2, so everything else shows
// its not-yet state: the project switcher "No project open", the run control "No project to run" (no start
// control), the deploy status "Not deployed", the coding agent "not set up" (P6), and each tab and panel view the
// empty state that names the phase that fills it.
import {
	DEFAULT_SHELL_LAYOUT,
	type OutputOf,
	type ShellLayout,
	type ThemePreference,
} from "@ak-studio/contract";
import {
	BottomPanel,
	type BottomPanelLayout,
	type BottomPanelTabId,
	BuildWithAIButton,
	createToastQueue,
	DeployStatus,
	DesktopShell,
	InlineBanner,
	notifyBackgroundResult,
	Popover,
	ProjectSwitcher,
	RunControl,
	SettingsButton,
	SettingsModal,
	StatusBar,
	ToastRegion,
	WindowControls,
} from "@ak-studio/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { getTransport, isStudioFailure } from "../../shared/bridge/client";
import {
	cacheStoredLayout,
	cacheStoredTheme,
	useAppInfo,
} from "../../shared/queries";
import { useStudioMutation } from "../../shared/query/hooks";
import { useWindowMaximized } from "../useWindowMaximized";
import { tabFromPath } from "./routes";
import { shellStrings } from "./strings";
import { PanelEmptyState } from "./TabEmptyState";

/** Room kept at the top bar's left for the macOS traffic lights (px): the three lights and their margin. */
const MAC_TRAFFIC_LIGHTS_INSET = 76;

/** A window control press. A failure is not shown: the window simply does not change, and the next press tries again. */
function requestWindow(
	name: "window.minimize" | "window.toggleMaximize" | "window.close",
): void {
	getTransport()
		.request(name, {})
		.catch((error: unknown) => {
			console.error(`[studio] ${name} failed: ${describeError(error)}`);
		});
}

function describeError(error: unknown): string {
	return isStudioFailure(error) ? error.error.message : String(error);
}

/** The root route. Waits for `app.info` (the stored layout sizes the panels when they mount). */
export function Shell() {
	const info = useAppInfo();
	// Under 300 ms in practice (a local call): no indicator, the themed page shows meanwhile.
	if (info.isPending) return null;
	return <LoadedShell info={info.data} error={info.error} />;
}

function LoadedShell({
	info,
	error,
}: {
	info: OutputOf<"app.info"> | undefined;
	error: unknown;
}) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const tab = tabFromPath(pathname);

	const [layout, setLayout] = useState<ShellLayout>(
		info?.layout ?? DEFAULT_SHELL_LAYOUT,
	);
	const [panelTab, setPanelTab] = useState<BottomPanelTabId>("problems");
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [toasts] = useState(createToastQueue);

	const saveLayout = useStudioMutation("app.setLayout", {
		onSuccess: (stored) => cacheStoredLayout(queryClient, stored),
		// Saved in the background as the person works: a failure is a background notice, not a blocking error.
		onError: () =>
			notifyBackgroundResult(toasts, {
				tone: "danger",
				title: shellStrings.layoutNotSaved.title,
				description: shellStrings.layoutNotSaved.description,
			}),
	});
	const saveTheme = useStudioMutation("app.setTheme", {
		onSuccess: (stored) => cacheStoredTheme(queryClient, stored),
	});

	const rememberPanel = (bottomPanel: BottomPanelLayout) => {
		const next = { bottomPanel };
		setLayout(next);
		saveLayout.mutate({ layout: next });
	};

	const theme: ThemePreference = info?.theme ?? "system";
	const mac = info?.platform === "darwin";
	const maximized = useWindowMaximized();

	return (
		<>
			<DesktopShell
				selectedTab={tab}
				onTabChange={(next) => {
					void navigate({ to: "/$tab", params: { tab: next } });
				}}
				// The window has no system title bar: the top bar is its drag region. Linux and Windows (and the
				// browser) get our controls; macOS keeps its own traffic lights, so only room is kept for them.
				leadingInset={mac ? MAC_TRAFFIC_LIGHTS_INSET : undefined}
				windowControls={
					mac ? undefined : (
						<WindowControls
							maximized={maximized}
							onMinimize={() => requestWindow("window.minimize")}
							onToggleMaximize={() => requestWindow("window.toggleMaximize")}
							onClose={() => requestWindow("window.close")}
						/>
					)
				}
				project={<ProjectSwitcher />}
				actions={
					<>
						<RunControl state="no-project" />
						<DeployStatus state="not-deployed" />
						<Popover
							title={shellStrings.buildWithAI.title}
							placement="bottom end"
							trigger={<BuildWithAIButton />}
						>
							<p className="text-ui text-text">
								{shellStrings.buildWithAI.description}
							</p>
						</Popover>
						<SettingsButton
							onPress={() => {
								// A failure from an earlier visit is not shown again.
								saveTheme.reset();
								setSettingsOpen(true);
							}}
						/>
					</>
				}
				bottomPanel={
					<BottomPanel
						isOpen={layout.bottomPanel.open}
						onOpenChange={(open) =>
							rememberPanel({ ...layout.bottomPanel, open })
						}
						selectedTab={panelTab}
						onTabChange={setPanelTab}
						problems={<PanelEmptyState tab="problems" />}
						runLog={<PanelEmptyState tab="run-log" />}
						commands={<PanelEmptyState tab="commands" />}
						strings={mac ? { shortcut: shellStrings.macShortcut } : undefined}
					/>
				}
				bottomPanelLayout={layout.bottomPanel}
				onBottomPanelLayoutChange={rememberPanel}
				statusBar={
					<StatusBar
						codingAgent={shellStrings.codingAgentNotSetUp}
						appVersion={info?.version}
					/>
				}
			>
				{error ? (
					<div className="p-4">
						<InlineBanner tone="danger" title={describeError(error)}>
							{shellStrings.bridgeError}
						</InlineBanner>
					</div>
				) : null}
				<Outlet />
			</DesktopShell>
			<SettingsModal
				isOpen={settingsOpen}
				onOpenChange={setSettingsOpen}
				theme={theme}
				onThemeChange={(next) => saveTheme.mutate({ theme: next })}
				error={
					saveTheme.isError
						? {
								title: describeError(saveTheme.error),
								description: shellStrings.themeNotSaved,
							}
						: undefined
				}
			/>
			<ToastRegion queue={toasts} />
		</>
	);
}
