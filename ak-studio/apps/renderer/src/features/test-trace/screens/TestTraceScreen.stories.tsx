// Storybook story for the Test & trace tab's screen (indexed from the renderer, P1b-plan ruling 16): its one P1b state,
// the empty state naming the phase that fills the tab. Type-free CSF, as the renderer does not depend on Storybook.
import { TestTraceScreen } from "./TestTraceScreen";

export default {
	title: "Screens/Test & trace",
	component: TestTraceScreen,
};

/** The tab before its phase lands: an empty state that says what will be here. */
export const Empty = {};
