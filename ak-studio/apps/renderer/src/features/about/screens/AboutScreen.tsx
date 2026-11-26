// The About feature's screen, mounted at /about (manifest.ts). Until Task 18 builds it from the patterns, it is the
// empty state that says what About is for; its data comes from the feature's hooks (api/), each state with a story.
import { EmptyState } from "@ak-studio/ui";
import { IconInfoCircle } from "@tabler/icons-react";
import { aboutStrings } from "../strings";

export function AboutScreen() {
	return (
		<EmptyState
			title={aboutStrings.title}
			description={aboutStrings.empty.description}
			icon={<IconInfoCircle aria-hidden="true" />}
			className="h-full"
		/>
	);
}
