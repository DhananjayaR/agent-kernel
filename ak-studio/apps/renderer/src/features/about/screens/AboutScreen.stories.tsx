// Storybook stories for the About screen (indexed from the renderer, P1b-plan ruling 16), one per state. Type-free
// CSF, as the renderer does not depend on Storybook.
import { AboutScreen } from "./AboutScreen";

export default {
	title: "Screens/About",
	component: AboutScreen,
};

/** Before Task 18 builds the screen: the empty state that says what About is for. */
export const Empty = {};
