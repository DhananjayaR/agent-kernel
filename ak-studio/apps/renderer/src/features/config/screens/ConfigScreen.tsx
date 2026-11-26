// The Config tab's screen. In P1b it is the empty state that names the phase that fills it: the Config tab: config.yaml's sections as forms (P3, editing in P4).
import { EmptyState } from "@ak-studio/ui";
import { IconAdjustmentsHorizontal } from "@tabler/icons-react";
import { configStrings } from "../strings";

export function ConfigScreen() {
	return (
		<EmptyState
			title={configStrings.empty.title}
			description={configStrings.empty.description}
			icon={<IconAdjustmentsHorizontal aria-hidden="true" />}
			className="h-full"
		/>
	);
}
