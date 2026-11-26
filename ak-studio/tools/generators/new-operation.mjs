// `pnpm new:operation <feature> <name> --shape query|command|job [--desktop]`: adds one operation to a feature,
// end to end (architecture.md, The contract and Main-process services). The operation is named
// `<feature>.<camelCaseName>` (`about set-note` -> `about.setNote`, declared as `aboutSetNote`).
//
//   packages/contract/src/<feature>.ts      the declaration (input {}, output or result {}); created on the
//                                           feature's first operation and exported from the contract's index
//   packages/contract/src/operations.ts     the declaration joins the `operations` map
//   packages/runtime/src/<feature>/<Feature>Service.ts (+ .test.ts)
//                                           the handler (a job: its runner, given to JobService), in the
//                                           feature's runtime service; created on the first operation and listed
//                                           in packages/runtime/src/features.ts, which the desktop app and the
//                                           mock transport both register (P1b-plan ruling 9)
//   apps/renderer/src/features/<feature>/api/use<Feature><Name>.ts (+ .test.tsx)
//                                           the hook: useStudioQuery, useStudioMutation or useStartJob
//
// With --desktop (a query or a command whose handler needs Node or Electron), the handler goes in
// apps/desktop/src/main/services/<Feature>Service.ts instead, registered in registerServices.ts, and the mock
// transport answers it from a fixture in apps/renderer/src/shared/bridge/desktopFixtures.ts. A job is never
// desktop-only: its runner reaches Node through the runtime's ports (CommandRunner, ProjectFs).
//
// Refuses a name that is not kebab-case or is a path, a feature that does not exist, an operation that exists,
// and an edit point it cannot find; a refused run writes nothing.
import { readdirSync } from "node:fs";
import {
	addImport,
	addNamedImport,
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
import * as t from "./templates/operation.mjs";

const USAGE =
	"usage: pnpm new:operation <feature> <name> --shape query|command|job [--desktop]";
const SHAPES = ["query", "command", "job"];
/** Operation names that would clash with the service class's own members. */
const RESERVED_OPERATIONS = new Set(["register", "constructor"]);

const CONTRACT = "packages/contract/src";
const OPERATIONS = `${CONTRACT}/operations.ts`;
const CONTRACT_INDEX = `${CONTRACT}/index.ts`;
const RUNTIME_FEATURES = "packages/runtime/src/features.ts";
const REGISTER_SERVICES = "apps/desktop/src/main/services/registerServices.ts";
const DESKTOP_FIXTURES = "apps/renderer/src/shared/bridge/desktopFixtures.ts";

/** Every name the contract's modules export, so a new declaration cannot shadow one. */
function contractExports(plan) {
	const names = new Set();
	for (const file of readdirSync(plan.abs(CONTRACT)))
		if (file.endsWith(".ts") && !file.endsWith(".test.ts"))
			for (const m of plan
				.read(`${CONTRACT}/${file}`)
				.matchAll(
					/^export (?:const|let|function|class|type|interface|enum) (\w+)/gm,
				))
				names.add(m[1]);
	return names;
}

/**
 * Adds a method before `register` and its lines at the end of `register`, which must be the class's last member
 * (code after the class is fine).
 */
function addToService(text, path, method, lines) {
	const m = find(
		text,
		/\n(\tregister\(registry: [^)]*\): void \{\n)((?:[^\n]*\n)*?)(\t\}\n\}\n)/,
		path,
		"the service's `register` method as the last member of the class",
	);
	const at = m.index;
	const end = m.index + m[0].length;
	return `${text.slice(0, at)}${method}\n${m[1]}${m[2]}${lines}${m[3]}${text.slice(end)}`;
}

/** Adds a test case at the end of the file's last `describe`. */
function addCase(text, path, testCase) {
	const m = find(
		text,
		/\n\}\);\n?$/,
		path,
		"the closing `});` of the describe at the end of the file",
	);
	return `${text.slice(0, m.index)}\n${testCase}});\n`;
}

/** Puts `"name": ident,` into the `operations` map, keeping it sorted by name. */
function addToOperationsMap(text, op, ident) {
	const m = find(
		text,
		/(export const operations = \{\n)([\s\S]*?)(\n\} as const satisfies ShapedOperationMap;)/,
		OPERATIONS,
		"the `operations` map",
	);
	const entries = [...m[2].matchAll(/"([^"]+)":\s*(\w+),/g)];
	const rest = m[2].replace(/"([^"]+)":\s*(\w+),/g, "").trim();
	if (rest !== "")
		throw new GeneratorError(
			`${OPERATIONS}: the \`operations\` map holds something other than \`"name": declaration,\` entries (${rest.split("\n")[0]}); add ${op} by hand`,
		);
	const lines = [
		...entries.map((e) => `\t"${e[1]}": ${e[2]},`),
		`\t"${op}": ${ident},`,
	];
	lines.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
	return text.replace(m[0], () => `${m[1]}${lines.join("\n")}${m[3]}`);
}

/** Adds a class to the FEATURE_SERVICES list in packages/runtime/src/features.ts. */
function addFeatureService(text, className) {
	const m = find(
		text,
		/(const FEATURE_SERVICES: readonly \(new \(\) => FeatureService\)\[\] = \[)([^\]]*)(\];)/,
		RUNTIME_FEATURES,
		"the FEATURE_SERVICES list",
	);
	const names = m[2]
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	const all = [...new Set([...names, className])].sort();
	return text.replace(m[0], () => `${m[1]}${all.join(", ")}${m[3]}`);
}

export function planOperation(plan, featureName, operationName, options) {
	checkName("feature", featureName);
	const f = namesOf(featureName);
	const featureDir = `apps/renderer/src/features/${featureName}`;
	if (!plan.exists(`${featureDir}/manifest.ts`))
		throw new GeneratorError(
			`there is no feature "${featureName}" (${featureDir}/manifest.ts): create it first with \`pnpm new:feature ${featureName}\``,
		);
	checkName("operation", operationName);
	if (RESERVED_OPERATIONS.has(operationName))
		throw new GeneratorError(
			`"${operationName}" is a member of every service class: choose another name`,
		);
	const o = namesOf(operationName);
	const shape = options.shape;
	if (!SHAPES.includes(shape))
		throw new GeneratorError(
			`--shape must be one of ${SHAPES.join(", ")}${shape ? `, not "${shape}"` : ""}\n${USAGE}`,
		);
	if (options.desktop && shape === "job")
		throw new GeneratorError(
			"a job is never desktop-only: its runner lives in the feature's runtime service and reaches Node through the runtime's ports (CommandRunner, ProjectFs). Drop --desktop.",
		);
	if (shape === "query" && !plan.exists(`${featureDir}/api/keys.ts`))
		throw new GeneratorError(
			`${featureDir}/api/keys.ts is missing: a query's hook takes its key from it`,
		);

	const op = `${featureName}.${o.camel}`;
	const ident = `${f.camel}${o.pascal}`;
	if (plan.read(OPERATIONS).includes(`"${op}"`))
		throw new GeneratorError(
			`${op} is already in the operations map: nothing was written`,
		);
	if (contractExports(plan).has(ident))
		throw new GeneratorError(
			`the contract already exports ${ident}: choose another operation name`,
		);
	const hookName = `use${f.pascal}${o.pascal}`;
	const builder = shape;

	// The contract: the feature's file, the operations map and (first time) the index.
	const contractFile = `${CONTRACT}/${featureName}.ts`;
	const declare = (text) =>
		addNamedImport(
			`${text}${t.declaration(f, o, op, shape)}`,
			"./shapes",
			[builder],
			{
				path: contractFile,
			},
		);
	if (plan.exists(contractFile)) plan.edit(contractFile, declare);
	else {
		plan.create(contractFile, declare(t.contractFile(f)));
		plan.edit(CONTRACT_INDEX, (text) => {
			const last = [...text.matchAll(/^export \* from "[^"]+";\n/gm)].at(-1);
			if (!last)
				throw new GeneratorError(
					`${CONTRACT_INDEX}: cannot find an \`export * from\` line to add the feature's after`,
				);
			const at = last.index + last[0].length;
			return `${text.slice(0, at)}export * from "./${featureName}";\n${text.slice(at)}`;
		});
	}
	plan.edit(OPERATIONS, (text) =>
		addToOperationsMap(
			addNamedImport(text, `./${featureName}`, [ident], { path: OPERATIONS }),
			op,
			ident,
		),
	);

	// The handler, in the feature's runtime or desktop service.
	const dir = options.desktop
		? "apps/desktop/src/main/services"
		: `packages/runtime/src/${featureName}`;
	const service = `${dir}/${f.pascal}Service.ts`;
	const serviceTest = `${dir}/${f.pascal}Service.test.ts`;
	const contractTypes =
		shape === "job" ? ["JobResultOf"] : ["HandlerResultOf", "Operations"];
	const withHandler = (text) => {
		if (new RegExp(`^\\t(?:async )?${o.camel}\\(`, "m").test(text))
			throw new GeneratorError(
				`${service} already has a ${o.camel} method: nothing was written`,
			);
		return addNamedImport(
			addToService(
				text,
				service,
				t.serviceMethod(o, op, shape),
				t.registerLines(o, op, shape),
			),
			"@ak-studio/contract",
			contractTypes,
			{ typeOnly: true, path: service },
		);
	};
	const withCase = (text) =>
		addCase(text, serviceTest, t.runtimeServiceCase(op, shape));
	if (plan.exists(service)) {
		plan.edit(service, withHandler);
		plan.edit(serviceTest, withCase);
	} else if (options.desktop) {
		plan.create(service, withHandler(t.desktopService(f)));
		plan.create(serviceTest, withCase(t.desktopServiceTest(f)));
		plan.edit(REGISTER_SERVICES, (text) => {
			const anchor = find(
				text,
				/\tregisterFeatureServices\(registry, [^\n]*\);\n/,
				REGISTER_SERVICES,
				"the `registerFeatureServices(registry, ...)` line",
			);
			const at = anchor.index + anchor[0].length;
			return addImport(
				`${text.slice(0, at)}\tregistry.register(new ${f.pascal}Service());\n${text.slice(at)}`,
				`import { ${f.pascal}Service } from "./${f.pascal}Service";`,
				REGISTER_SERVICES,
			);
		});
	} else {
		plan.create(service, withHandler(t.runtimeService(f)));
		plan.create(serviceTest, withCase(t.runtimeServiceTest(f)));
		plan.edit(RUNTIME_FEATURES, (text) =>
			addImport(
				addFeatureService(text, `${f.pascal}Service`),
				`import { ${f.pascal}Service } from "./${featureName}/${f.pascal}Service";`,
				RUNTIME_FEATURES,
			),
		);
	}
	if (options.desktop)
		plan.edit(DESKTOP_FIXTURES, (text) => {
			const m = find(
				text,
				/(export const desktopFixtureHandlers: FixtureHandlers = \{)([\s\S]*)(\};\s*)$/,
				DESKTOP_FIXTURES,
				"the `desktopFixtureHandlers` object at the end of the file",
			);
			return text.replace(
				m[0],
				() => `${m[1]}${m[2].trimEnd()}\n\t"${op}": () => ({}),\n};\n`,
			);
		});

	// The hook and its test.
	plan.create(`${featureDir}/api/${hookName}.ts`, t.hook(f, o, op, shape));
	plan.create(
		`${featureDir}/api/${hookName}.test.tsx`,
		t.hookTest(f, o, op, shape),
	);
	return { op, ident, hookName, service };
}

function main(argv) {
	const cli = parseCli(argv, {
		options: { shape: "string", desktop: "boolean" },
		positionals: 2,
		usage: USAGE,
	});
	if (cli.help) {
		console.log(USAGE);
		return;
	}
	const [feature, name] = cli.positionals;
	const plan = new Plan();
	const made = planOperation(plan, feature, name, {
		shape: cli.values.shape,
		desktop: cli.values.desktop === true,
	});
	const written = plan.write();
	report(
		`new:operation: added ${made.op} (${cli.values.shape}${cli.values.desktop ? ", desktop-only" : ""})`,
		plan,
		written,
		`Next: give ${made.ident} its input and output, ${made.service} its handler, and ${made.hookName} its callers; update their tests with them.`,
	);
}

if (isMain(import.meta.url)) runCli(main);
