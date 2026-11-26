// The Code tab's screen. In P1b it is the empty state that names the phase that fills it: the Code tab: the project's files, a tree and a viewer (P3).
import { EmptyState } from "@ak-studio/ui";
import { IconFileCode } from "@tabler/icons-react";
import { codeStrings } from "../strings";

export function CodeScreen() {
	return (
		<EmptyState
			title={codeStrings.empty.title}
			description={codeStrings.empty.description}
			icon={<IconFileCode aria-hidden="true" />}
			className="h-full"
		/>
	);
}
