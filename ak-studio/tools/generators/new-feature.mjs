// `pnpm new:feature <name>`: creates a feature folder in the renderer (architecture.md, Features) and lists its
// manifest in app/features.ts, the one list of features. The feature gets a route at /<name> and no tab (a tab is
// added by hand to the manifest, with its order among the others). It has no operations yet: add them with
// `pnpm new:operation <name> <operation> --shape query|command|job`.
//
//   apps/renderer/src/features/<name>/
//     manifest.ts, manifest.test.tsx    id, route, commands, capabilities; the route mounts the screen
//     strings.ts                        the feature's copy (its title)
//     api/keys.ts                       the query-key factory, keys("<name>")
//     model/store.ts, model/store.test.ts   the feature store (UI state)
//     components/                       empty: components used only by this feature
//     screens/<Name>Screen.tsx, <Name>Screen.stories.tsx
//
// Refuses a name that is not kebab-case, that is a path, that is taken by a feature, or that would collide with a
// contract or runtime module (the contract file and the service folder `new:operation` creates are named after
// the feature).
import {
	addImport,
	checkName,
	find,
	GeneratorError,
	isMain,
	namesOf,
	Plan,
	parseCli,
	report,
	runCli,
} from "./lib.mjs";
import * as t from "./templates/feature.mjs";

const USAGE = "usage: pnpm new:feature <name>   (kebab-case: release-notes)";

/**
 * Names a feature may not take: the shell's own manifest, the app's own operation domains (app.*, job.*, ...) and
 * the shared folders. A name that matches a contract or runtime module is refused separately, from the disk.
 */
export const RESERVED_FEATURES = new Set([
	"app",
	"features",
	"job",
	"jobs",
	"session",
	"sessions",
	"shared",
	"shell",
	"stream",
	"streams",
	"window",
	"events",
]);

const FEATURES_LIST = "apps/renderer/src/app/features.ts";

/** Refuses a feature name that is reserved, taken, or that would collide with a contract or runtime module. */
export function checkNewFeature(plan, name) {
	checkName("feature", name);
	if (RESERVED_FEATURES.has(name))
		throw new GeneratorError(
			`"${name}" is reserved (the shell, the app's own operations or a shared folder): choose another name`,
		);
	const dir = `apps/renderer/src/features/${name}`;
	if (plan.exists(dir))
		throw new GeneratorError(`${dir} already exists: nothing was written`);
	for (const taken of [
		`packages/contract/src/${name}.ts`,
		`packages/runtime/src/${name}.ts`,
		`packages/runtime/src/${name}`,
	])
		if (plan.exists(taken))
			throw new GeneratorError(
				`${taken} exists, and the feature's operations would be declared or served there: choose another name`,
			);
	const n = namesOf(name);
	if (new RegExp(`\\b${n.camel}Feature\\b`).test(plan.read(FEATURES_LIST)))
		throw new GeneratorError(
			`${FEATURES_LIST} already lists ${n.camel}Feature: nothing was written`,
		);
}

export function planFeature(plan, name) {
	checkNewFeature(plan, name);
	const n = namesOf(name);
	const dir = `apps/renderer/src/features/${name}`;
	plan.create(`${dir}/manifest.ts`, t.manifest(n));
	plan.create(`${dir}/manifest.test.tsx`, t.manifestTest(n));
	plan.create(`${dir}/strings.ts`, t.strings(n));
	plan.create(`${dir}/api/keys.ts`, t.keys(n));
	plan.create(`${dir}/model/store.ts`, t.store(n));
	plan.create(`${dir}/model/store.test.ts`, t.storeTest(n));
	plan.mkdir(`${dir}/components`);
	plan.create(`${dir}/screens/${n.pascal}Screen.tsx`, t.screen(n));
	plan.create(
		`${dir}/screens/${n.pascal}Screen.stories.tsx`,
		t.screenStories(n),
	);
	plan.edit(FEATURES_LIST, (text) => {
		const list = find(
			text,
			/(export const features: readonly FeatureManifest\[\] = \[)([\s\S]*?)(\];)/,
			FEATURES_LIST,
			"the `features` array",
		);
		const items = list[2].trimEnd().replace(/,$/, "");
		const listed = `${list[1]}${items}${items.trim() ? "," : ""}\n\t${n.camel}Feature,\n${list[3]}`;
		const withEntry = text.replace(list[0], () => listed);
		return addImport(
			withEntry,
			`import { ${n.camel}Feature } from "../features/${name}/manifest";`,
			FEATURES_LIST,
		);
	});
	return n;
}

function main(argv) {
	const cli = parseCli(argv, { options: {}, positionals: 1, usage: USAGE });
	if (cli.help) {
		console.log(USAGE);
		return;
	}
	const [name] = cli.positionals;
	const plan = new Plan();
	planFeature(plan, name);
	const written = plan.write();
	report(
		`new:feature: created the ${name} feature`,
		plan,
		written,
		`Next: add its operations with \`pnpm new:operation ${name} <operation> --shape query|command|job [--project]\`, and a tab (if it has one) in its manifest. The screen shows only the title: a real feature's screen gets an empty state that says what the place is for and offers the first action (copy rules) before it ships; a sample task may leave it as it is.`,
	);
}

if (isMain(import.meta.url)) runCli(main);
