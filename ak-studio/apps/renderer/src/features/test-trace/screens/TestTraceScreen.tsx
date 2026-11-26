// The Test & trace tab's screen. In P1b it is the empty state that names the phase that fills it: the Test & trace tab: chat and traces (P8), then tests and run history (P9).
import { EmptyState } from "@ak-studio/ui";
import { IconFlask } from "@tabler/icons-react";
import { testTraceStrings } from "../strings";

export function TestTraceScreen() {
	return (
		<EmptyState
			title={testTraceStrings.empty.title}
			description={testTraceStrings.empty.description}
			icon={<IconFlask aria-hidden="true" />}
			className="h-full"
		/>
	);
}
