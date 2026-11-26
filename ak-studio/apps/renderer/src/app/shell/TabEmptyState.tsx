// One app tab's content in P1a: its empty state, naming the phase that fills it.
import {
	type AppTabId,
	type BottomPanelTabId,
	EmptyState,
} from "@ak-studio/ui";
import {
	IconAdjustmentsHorizontal,
	IconFileCode,
	IconFlask,
	IconPackages,
	IconRocket,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { panelEmptyStates, tabEmptyStates } from "./strings";

const TAB_ICONS: Record<AppTabId, ReactNode> = {
	canvas: <IconPackages aria-hidden="true" />,
	code: <IconFileCode aria-hidden="true" />,
	config: <IconAdjustmentsHorizontal aria-hidden="true" />,
	"test-trace": <IconFlask aria-hidden="true" />,
	deploy: <IconRocket aria-hidden="true" />,
};

export function TabEmptyState({ tab }: { tab: AppTabId }) {
	const { title, description } = tabEmptyStates[tab];
	return (
		<EmptyState
			title={title}
			description={description}
			icon={TAB_ICONS[tab]}
			className="h-full"
		/>
	);
}

export function PanelEmptyState({ tab }: { tab: BottomPanelTabId }) {
	const { title, description } = panelEmptyStates[tab];
	return (
		<EmptyState
			title={title}
			description={description}
			headingLevel={3}
			className="h-full p-4"
		/>
	);
}
