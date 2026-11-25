// The desktop shell in the app: the design system's DesktopShell wired to the bridge. Real data where it exists in
// P1a: the Studio's version (status bar), the theme preference (settings) and the remembered panel layout (an app
// preference, stored by main through `app.setLayout`). No project can be opened before P2, so everything else shows
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
} from "@ak-studio/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { isStudioFailure } from "../bridge/client";
import {
	appInfoQueryKey,
	cacheStoredLayout,
	cacheStoredTheme,
	fetchAppInfo,
	storeLayout,
	storeTheme,
} from "../queries";
import { tabFromPath } from "./routes";
import { shellStrings } from "./strings";
import { PanelEmptyState } from "./TabEmptyState";

function describeError(error: unknown): string {
	return isStudioFailure(error) ? error.error.message : String(error);
}

/** The root route. Waits for `app.info` (the stored layout sizes the panels when they mount). */
export function Shell() {
	const info = useQuery({ queryKey: appInfoQueryKey, queryFn: fetchAppInfo });
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

	const saveLayout = useMutation({
		mutationFn: storeLayout,
		onSuccess: (stored) => cacheStoredLayout(queryClient, stored),
		// Saved in the background as the person works: a failure is a background notice, not a blocking error.
		onError: () =>
			notifyBackgroundResult(toasts, {
				tone: "danger",
				title: shellStrings.layoutNotSaved.title,
				description: shellStrings.layoutNotSaved.description,
			}),
	});
	const saveTheme = useMutation({
		mutationFn: storeTheme,
		onSuccess: (stored) => cacheStoredTheme(queryClient, stored),
	});

	const rememberPanel = (bottomPanel: BottomPanelLayout) => {
		const next = { bottomPanel };
		setLayout(next);
		saveLayout.mutate(next);
	};

	const theme: ThemePreference = info?.theme ?? "system";
	const mac = info?.platform === "darwin";

	return (
		<>
			<DesktopShell
				selectedTab={tab}
				onTabChange={(next) => {
					void navigate({ to: "/$tab", params: { tab: next } });
				}}
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
						<SettingsButton onPress={() => setSettingsOpen(true)} />
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
				onThemeChange={(next) => saveTheme.mutate(next)}
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
