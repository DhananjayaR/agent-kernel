// The Canvas tab's screen. In P1b it is the empty state that names the phase that fills it: the canvas: the project's agents, tools and handoffs as a graph (P3).
import { EmptyState } from "@ak-studio/ui";
import { IconPackages } from "@tabler/icons-react";
import { canvasStrings } from "../strings";

export function CanvasScreen() {
	return (
		<EmptyState
			title={canvasStrings.empty.title}
			description={canvasStrings.empty.description}
			icon={<IconPackages aria-hidden="true" />}
			className="h-full"
		/>
	);
}
