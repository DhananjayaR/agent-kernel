// `pnpm new:component <name> [--group Controls|Display|Overlays|Structure|Patterns]`: adds a presentational
// component to @ak-studio/ui.
//
//   packages/ui/src/components/<name>.tsx           the component (<Name>, <Name>Props)
//   packages/ui/src/components/<name>.stories.tsx   its stories, listed under <group>/<Name in sentence case>
//   packages/ui/src/index.ts                        exports both names, in path order
//
// The group defaults to Display. Refuses a name that is not kebab-case or is a path, and a component that exists.
// New stories have no visual-regression baseline yet: run `pnpm test:visual` and commit the screenshots.
import {
	checkName,
	GeneratorError,
	isMain,
	namesOf,
	Plan,
	parseCli,
	report,
	runCli,
} from "./lib.mjs";
import * as t from "./templates/component.mjs";

const USAGE =
	"usage: pnpm new:component <name> [--group Controls|Display|Overlays|Structure|Patterns]";
const GROUPS = ["Controls", "Display", "Overlays", "Structure", "Patterns"];
const UI_INDEX = "packages/ui/src/index.ts";

/** Inserts the component's export among the ./components/ exports, in path order. */
function addExport(text, kebab, line) {
	const blocks = [
		...text.matchAll(/^export \{[^}]*\} from "\.\/components\/([^"]+)";\n/gm),
	];
	if (blocks.length === 0)
		throw new GeneratorError(
			`${UI_INDEX}: cannot find the ./components/ exports. Restore them, or add the export by hand.`,
		);
	const next = blocks.find((b) => b[1] > kebab);
	const at = next ? next.index : blocks.at(-1).index + blocks.at(-1)[0].length;
	return `${text.slice(0, at)}${line}\n${text.slice(at)}`;
}

export function planComponent(plan, name, options = {}) {
	checkName("component", name);
	const group = options.group ?? "Display";
	if (!GROUPS.includes(group))
		throw new GeneratorError(
			`--group must be one of ${GROUPS.join(", ")}, not "${group}"`,
		);
	const n = namesOf(name);
	const file = `packages/ui/src/components/${name}.tsx`;
	if (plan.exists(file))
		throw new GeneratorError(`${file} already exists: nothing was written`);
	const index = plan.read(UI_INDEX);
	if (new RegExp(`\\b${n.pascal}\\b`).test(index))
		throw new GeneratorError(
			`${UI_INDEX} already exports a name ${n.pascal}: choose another component name`,
		);
	plan.create(file, t.component(n));
	plan.create(
		`packages/ui/src/components/${name}.stories.tsx`,
		t.stories(n, group),
	);
	plan.edit(UI_INDEX, (text) =>
		addExport(
			text,
			name,
			`export { ${n.pascal}, type ${n.pascal}Props } from "./components/${name}";`,
		),
	);
	return n;
}

function main(argv) {
	const cli = parseCli(argv, {
		options: { group: "string" },
		positionals: 1,
		usage: USAGE,
	});
	if (cli.help) {
		console.log(USAGE);
		return;
	}
	const [name] = cli.positionals;
	const plan = new Plan();
	const n = planComponent(plan, name, { group: cli.values.group });
	const written = plan.write();
	report(
		`new:component: created ${n.pascal} in @ak-studio/ui`,
		plan,
		written,
		"Next: give it its props and a story for each state, then run `pnpm test:storybook` and `pnpm test:visual`.",
	);
}

if (isMain(import.meta.url)) runCli(main);
