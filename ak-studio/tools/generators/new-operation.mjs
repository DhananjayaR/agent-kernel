// `pnpm new:operation <feature> <name> --shape query|command|job [--desktop] [--project]`: adds one operation to a
// feature, end to end (architecture.md, The contract and Main-process services). The operation is named
// `<feature>.<camelCaseName>` (`about set-note` -> `about.setNote`, declared as `aboutSetNote`).
//
//   packages/contract/src/<feature>.ts      the declaration (input {}, output or result {}); created on the
//                                           feature's first operation and exported from the contract's index
//   packages/contract/src/operations.ts     the declaration joins the `operations` map
//   packages/runtime/src/<feature>/<Feature>Service.ts (+ .test.ts)
//                                           the handler (a job: its runner, given to JobService), in the
//                                           feature's runtime service, which takes its dependencies (the ports and
//                                           the core services) in its constructor; created on the first operation
//                                           and its factory listed in packages/runtime/src/features.ts, which the
//                                           desktop app and the mock transport both register (P1b-plan ruling 9)
//   apps/renderer/src/features/<feature>/api/use<Feature><Name>.ts (+ .test.tsx)
//                                           the hook: useStudioQuery, useStudioMutation or useStartJob
//
// With --project, the input is `{ projectId }`, the operation lists `project.notOpen`, the handler requires the
// project's scope (`scopes.require(projectId)`; JobService does it for a job) and a query's hook keys by
// `keys(<feature>).detail(projectId, <name>)`.
// With --desktop (a query or a command whose handler needs Node or Electron), the handler goes in
// apps/desktop/src/main/services/<Feature>Service.ts instead, registered in registerServices.ts, and the mock
// transport answers it from a fixture in apps/renderer/src/shared/bridge/desktopFixtures.ts. A job is never
// desktop-only: its runner reaches Node through the ports in its service's constructor deps.
//
// Refuses a name that is not kebab-case or is a path, a feature that does not exist, an operation that exists,
// and an edit point it cannot find unambiguously; a refused run writes nothing.
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
	"usage: pnpm new:operation <feature> <name> --shape query|command|job [--desktop] [--project]";
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
 * Adds a method before `register` and its lines at the end of `register`'s body. Found by structure, not by the
 * end of the file: exactly one `register(registry: ...): void {` line, a body of blank lines or lines indented two
 * tabs or more, its own `\t}`, and then the class's closing `}` (so `register` is the class's last member; code
 * after the class is fine). Anything else is refused, so a hand edit can never capture the insert.
 */
function addToService(text, path, method, lines) {
	const refuse = (what) => {
		throw new GeneratorError(
			`${path}: ${what}. The generator adds each handler at the end of \`register\`, which must be the class's last member; restore that, or add the operation by hand.`,
		);
	};
	const heads = [
		...text.matchAll(/^\tregister\(registry: [^)\n]*\): void \{\n/gm),
	];
	if (heads.length !== 1)
		refuse(
			heads.length === 0
				? "cannot find the service's `register(registry: ...): void {` method"
				: "has more than one `register` method",
		);
	const head = heads[0];
	let close = head.index + head[0].length;
	for (;;) {
		const end = text.indexOf("\n", close);
		const line = text.slice(close, end < 0 ? undefined : end);
		if (end >= 0 && (line === "" || line.startsWith("\t\t"))) {
			close = end + 1;
			continue;
		}
		if (line !== "\t}") refuse("cannot find the closing `}` of `register`");
		break;
	}
	if (!/^\t\}\n\n*\}(?:\n|$)/.test(text.slice(close)))
		refuse("`register` is not the class's last member");
	// The new method goes above `register` and above any comment that sits directly on it (a JSDoc block or `//`
	// lines), so that comment stays with `register`.
	let at = head.index;
	for (;;) {
		const start = text.lastIndexOf("\n", at - 2) + 1;
		const line = text.slice(start, at - 1);
		if (!/^\t(?:\/\*\*| ?\*|\/\/)/.test(line)) break;
		at = start;
	}
	return `${text.slice(0, at)}${method.replace(/^\n/, "")}\n${text.slice(at, close)}${lines}${text.slice(close)}`;
}

/**
 * Adds a fixture answer to `desktopFixtureHandlers`, found by structure like the service's edit points: exactly one
 * `export const desktopFixtureHandlers: FixtureHandlers = {` line (or the empty `= {};`), and its own `};`.
 * Whatever follows the object is left alone.
 */
function addFixture(text, entry) {
	const refuse = (what) => {
		throw new GeneratorError(
			`${DESKTOP_FIXTURES}: ${what}. The generator adds each answer at the end of the \`desktopFixtureHandlers\` object; restore it, or add the answer by hand.`,
		);
	};
	const heads = [
		...text.matchAll(
			/^export const desktopFixtureHandlers: FixtureHandlers = \{(\};)?\n/gm,
		),
	];
	if (heads.length !== 1)
		refuse(
			heads.length === 0
				? "cannot find `export const desktopFixtureHandlers: FixtureHandlers = {`"
				: "declares `desktopFixtureHandlers` more than once",
		);
	const head = heads[0];
	if (head[1])
		return `${text.slice(0, head.index)}export const desktopFixtureHandlers: FixtureHandlers = {\n${entry}};\n${text.slice(head.index + head[0].length)}`;
	let close = head.index + head[0].length;
	for (;;) {
		const end = text.indexOf("\n", close);
		const line = text.slice(close, end < 0 ? undefined : end);
		if (end >= 0 && (line === "" || line.startsWith("\t"))) {
			close = end + 1;
			continue;
		}
		if (line !== "};") refuse("cannot find the `};` that closes the object");
		break;
	}
	return `${text.slice(0, close)}${entry}${text.slice(close)}`;
}

/**
 * Adds a test case at the end of the `describe("<Service>", ...)` block, found by structure: exactly one such
 * line, a body of blank or indented lines, and its own `});` at the start of a line. Code after the block (an
 * afterEach, a helper) is left where it is.
 */
function addCase(text, path, describeName, testCase) {
	const refuse = (what) => {
		throw new GeneratorError(
			`${path}: ${what}. The generator adds each case at the end of \`describe("${describeName}", ...)\`; restore it, or add the test by hand.`,
		);
	};
	const heads = [
		...text.matchAll(
			new RegExp(`^describe\\("${describeName}", \\(\\) => \\{\\n`, "gm"),
		),
	];
	if (heads.length !== 1)
		refuse(
			heads.length === 0
				? `cannot find \`describe("${describeName}", () => {\``
				: `has more than one \`describe("${describeName}", ...)\``,
		);
	let close = heads[0].index + heads[0][0].length;
	for (;;) {
		const end = text.indexOf("\n", close);
		const line = text.slice(close, end < 0 ? undefined : end);
		if (end >= 0 && (line === "" || line.startsWith("\t"))) {
			close = end + 1;
			continue;
		}
		if (line !== "});")
			refuse("cannot find the `});` that closes the describe");
		break;
	}
	return `${text.slice(0, close)}${testCase}${text.slice(close)}`;
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

/** Adds a service's factory, `(deps) => new X(deps)`, to FEATURE_SERVICES in packages/runtime/src/features.ts. */
function addFeatureService(text, className) {
	const m = find(
		text,
		/(const FEATURE_SERVICES: readonly \(\(deps: FeatureDeps\) => FeatureService\)\[\] =\s*\[)([^\]]*)(\];)/,
		RUNTIME_FEATURES,
		"the FEATURE_SERVICES list",
	);
	const factory = /\(deps\) => new (\w+)\(deps\)/g;
	const names = [...m[2].matchAll(factory)].map((e) => e[1]);
	if (m[2].replace(factory, "").replace(/[\s,]/g, "") !== "")
		throw new GeneratorError(
			`${RUNTIME_FEATURES}: FEATURE_SERVICES holds something other than \`(deps) => new XService(deps)\` factories; add ${className}'s by hand`,
		);
	const all = [...new Set([...names, className])].sort();
	const list = all.map((name) => `\t(deps) => new ${name}(deps),`).join("\n");
	return text.replace(m[0], () => `${m[1]}\n${list}\n${m[3]}`);
}

/** Adds `registry.register(new X(featureDeps))` after the desktop's runtime services and earlier desktop ones. */
function addDesktopService(text, className) {
	const anchor = find(
		text,
		/\tregisterFeatureServices\(registry, featureDeps\);\n(?:\tregistry\.register\(new \w+\(featureDeps\)\);\n)*/,
		REGISTER_SERVICES,
		"the `registerFeatureServices(registry, featureDeps);` line",
	);
	const at = anchor.index + anchor[0].length;
	return `${text.slice(0, at)}\tregistry.register(new ${className}(featureDeps));\n${text.slice(at)}`;
}

/** Refuses a feature whose contract or runtime module name is taken by something that is not the feature's. */
function checkFeatureModules(plan, featureName) {
	const contractFile = `${CONTRACT}/${featureName}.ts`;
	if (
		plan.exists(contractFile) &&
		!plan.read(contractFile).includes(`name: "${featureName}.`)
	)
		throw new GeneratorError(
			`${contractFile} exists and declares none of the ${featureName} feature's operations: it is another module, so the feature cannot have operations under this name`,
		);
	if (plan.exists(`packages/runtime/src/${featureName}.ts`))
		throw new GeneratorError(
			`packages/runtime/src/${featureName}.ts exists: it is another module, so the feature's service cannot live under this name`,
		);
}

export function planOperation(plan, featureName, operationName, options) {
	checkName("feature", featureName);
	const f = namesOf(featureName);
	const featureDir = `apps/renderer/src/features/${featureName}`;
	if (!plan.exists(`${featureDir}/manifest.ts`))
		throw new GeneratorError(
			`there is no feature "${featureName}" (${featureDir}/manifest.ts): create it first with \`pnpm new:feature ${featureName}\``,
		);
	checkFeatureModules(plan, featureName);
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
			"a job is never desktop-only: its runner lives in the feature's runtime service, which reaches Node through the ports in its constructor's deps (commandRunner, projectFs, watcher). Drop --desktop.",
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
	const x = { f, o, op, shape, project: options.project === true };
	const hookName = `use${f.pascal}${o.pascal}`;

	// The contract: the feature's file, the operations map and (first time) the index.
	const contractFile = `${CONTRACT}/${featureName}.ts`;
	const declare = (text) => {
		let next = addNamedImport(
			`${text}${t.declaration(x)}`,
			"./shapes",
			[shape],
			{ path: contractFile },
		);
		if (x.project) {
			next = addNamedImport(next, "./domain", ["ProjectId"], {
				path: contractFile,
			});
			next = addNamedImport(next, "./errors", ["ERROR_CODES"], {
				path: contractFile,
			});
		}
		return next;
	};
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
	const withHandler = (text) => {
		if (new RegExp(`^\\t(?:async )?${o.camel}\\(`, "m").test(text))
			throw new GeneratorError(
				`${service} already has a ${o.camel} method: nothing was written`,
			);
		return addNamedImport(
			addToService(text, service, t.serviceMethod(x), t.registerLines(x)),
			"@ak-studio/contract",
			t.serviceTypes(x),
			{ typeOnly: true, path: service },
		);
	};
	const withCase = (text) =>
		addCase(text, serviceTest, `${f.pascal}Service`, t.serviceCase(x));
	if (plan.exists(service)) {
		plan.edit(service, withHandler);
		plan.edit(serviceTest, withCase);
	} else if (options.desktop) {
		plan.create(service, withHandler(t.desktopService(f)));
		plan.create(serviceTest, withCase(t.serviceTest(f, "@ak-studio/runtime")));
		plan.edit(REGISTER_SERVICES, (text) =>
			addImport(
				addDesktopService(text, `${f.pascal}Service`),
				`import { ${f.pascal}Service } from "./${f.pascal}Service";`,
				REGISTER_SERVICES,
			),
		);
	} else {
		plan.create(service, withHandler(t.runtimeService(f)));
		plan.create(serviceTest, withCase(t.serviceTest(f, "runtime")));
		plan.edit(RUNTIME_FEATURES, (text) =>
			addImport(
				addFeatureService(text, `${f.pascal}Service`),
				`import { ${f.pascal}Service } from "./${featureName}/${f.pascal}Service";`,
				RUNTIME_FEATURES,
			),
		);
	}
	if (options.desktop)
		plan.edit(DESKTOP_FIXTURES, (text) => addFixture(text, t.fixture(x)));

	// The hook and its test.
	plan.create(`${featureDir}/api/${hookName}.ts`, t.hook(x));
	plan.create(`${featureDir}/api/${hookName}.test.tsx`, t.hookTest(x));
	return { op, ident, hookName, service };
}

function main(argv) {
	const cli = parseCli(argv, {
		options: { shape: "string", desktop: "boolean", project: "boolean" },
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
		project: cli.values.project === true,
	});
	const written = plan.write();
	report(
		`new:operation: added ${made.op} (${cli.values.shape}${cli.values.desktop ? ", desktop-only" : ""}${cli.values.project ? ", project-scoped" : ""})`,
		plan,
		written,
		`Next: give ${made.ident} its input and output, ${made.service} its handler, and ${made.hookName} its callers; update their tests with them.`,
	);
}

if (isMain(import.meta.url)) runCli(main);
