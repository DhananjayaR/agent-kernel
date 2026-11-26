// Planted for tools/check-stories.test.mjs. Knob is imported and named in this comment, and a story is named
// Knobs, but no story is about Knob and the meta's component is not Knob: coveredBy must fail for it.
import { Knob } from "./knob";
export default { title: "Planted", component: Group };
export const ChipRow = {};
export const Default = {};
export const Knobs = { render: () => Knob };
