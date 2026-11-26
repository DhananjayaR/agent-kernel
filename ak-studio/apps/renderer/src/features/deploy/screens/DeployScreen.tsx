// The Deploy tab's screen. In P1b it is the empty state that names the phase that fills it: the Deploy tab: deploying the project to a cloud target (P10).
import { EmptyState } from "@ak-studio/ui";
import { IconRocket } from "@tabler/icons-react";
import { deployStrings } from "../strings";

export function DeployScreen() {
	return (
		<EmptyState
			title={deployStrings.empty.title}
			description={deployStrings.empty.description}
			icon={<IconRocket aria-hidden="true" />}
			className="h-full"
		/>
	);
}
