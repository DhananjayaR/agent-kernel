// One bottom panel view's content until its phase fills it: its empty state, naming that phase. (Each tab's empty
// state is its feature's screen now, features/<id>/screens.)
import { type BottomPanelTabId, EmptyState } from "@ak-studio/ui";
import { panelEmptyStates } from "./strings";

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
