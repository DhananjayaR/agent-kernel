// Templates for `pnpm new:operation <feature> <name> --shape query|command|job [--desktop] [--project]`: the
// contract declaration, the service that handles it (in packages/runtime, or apps/desktop with --desktop), its
// test, and the feature's hook and the hook's test. Each takes `x`: `f` the feature's names and `o` the
// operation's (lib.mjs's `namesOf`), `op` the full name `<feature>.<camelCaseName>`, `shape`, and `project` (the
// input carries the project's id, and the operation needs the project open). The first operation of a feature
// creates the contract file and the service; later ones are added to them (new-operation.mjs).
import { comment } from "../lib.mjs";

/** What each shape is, in the declaration's doc comment (architecture.md, The contract). */
const SHAPE_DOC = {
	query: "a query: reads state, with no side effects",
	command: "a command: one write that finishes in under a second",
	job: "a job: slow or stepped work that ends with a result",
};

/** The project a generated test opens (the support-triage fixture's name). */
const PROJECT = "support-triage";

/** The operation's sample input in tests and hooks. */
const input = (x) =>
	x.project ? `{ projectId: ${JSON.stringify(PROJECT)} }` : "{}";

// ---- packages/contract/src/<feature>.ts ----

export const contractFile = (
	f,
) => `${comment(`The ${f.title} feature's operations (architecture.md, The contract), collected into \`operations\` in operations.ts. Builders come from ./shapes, never ./operations (that would be an import cycle). Inputs are strict objects; outputs are plain objects, so undeclared fields are stripped before they cross the bridge.`)}
import "./zodConfig";
import { z } from "zod";
`;

export function declaration(x) {
	const { f, o, op, shape, project } = x;
	const doc = `/** ${f.title}: ${o.title.toLowerCase()} (${SHAPE_DOC[shape]}${project ? "; the project must be open" : ""}). */`;
	const name = `${f.camel}${o.pascal}`;
	const inputSchema = project
		? "z.strictObject({ projectId: ProjectId })"
		: "z.strictObject({})";
	const errors = project ? "\n\terrors: [ERROR_CODES.projectNotOpen]," : "";
	if (shape === "job")
		return `
${doc}
export const ${name} = job({
	name: "${op}",
	input: ${inputSchema},
	result: z.object({}),${errors}
	title: "${o.title}",
	cancellable: true,
	survivesQuit: false,
});
`;
	return `
${doc}
export const ${name} = ${shape}({
	name: "${op}",
	input: ${inputSchema},
	output: z.object({}),${errors}
});
`;
}

// ---- The services: packages/runtime/src/<feature>/<Feature>Service.ts, apps/desktop/src/main/services (--desktop) ----

export const runtimeService = (
	f,
) => `${comment(`${f.pascal}Service: serves the ${f.title} feature's operations (architecture.md, Main-process services). It is browser-safe, like the rest of packages/runtime, so the desktop app and the browser's mock transport serve it alike (P1b-plan ruling 9); ../features.ts lists its factory. Its dependencies (the ports and the core services) come to the constructor. Each operation's handler is a method, and \`register\`, the last member, wires them; a job's runner is given to JobService there.`)}
import type { Operations } from "@ak-studio/contract";
import type { FeatureDeps, FeatureService } from "../features";
import type { RequestRegistrar } from "../registry";

export class ${f.pascal}Service implements FeatureService {
	readonly #deps: FeatureDeps;

	constructor(deps: FeatureDeps) {
		this.#deps = deps;
	}

	register(registry: RequestRegistrar<Operations>): void {
	}
}
`;

export const desktopService = (
	f,
) => `${comment(`${f.pascal}Service: serves the ${f.title} feature's operations that need Node or Electron (architecture.md, Main-process services), registered in registerServices.ts with the same dependencies as the runtime's feature services. The browser's mock transport answers the same operations from fixtures (apps/renderer/src/shared/bridge/desktopFixtures.ts). Each operation's handler is a method, and \`register\`, the last member, wires them. No Electron import: index.ts passes Electron's values in.`)}
import type { Operations } from "@ak-studio/contract";
import type {
	FeatureDeps,
	RequestRegistrar,
	Service,
} from "@ak-studio/runtime";

export class ${f.pascal}Service implements Service {
	readonly #deps: FeatureDeps;

	constructor(deps: FeatureDeps) {
		this.#deps = deps;
	}

	register(registry: RequestRegistrar<Operations>): void {
	}
}
`;

/** The types the service's import from the contract needs for one operation. */
export function serviceTypes(x) {
	if (x.shape === "job") return ["HandlerInputOf", "JobResultOf", "Operations"];
	return x.project
		? ["HandlerInputOf", "HandlerResultOf", "Operations"]
		: ["HandlerResultOf", "Operations"];
}

/** The handler method (or, for a job, the runner) the service gains for one operation. */
export function serviceMethod(x) {
	const { o, op, shape, project } = x;
	if (shape === "job")
		return `
	/**
	 * Runs one \`${op}\` job; its answer is the job's result.
	 * \`ctx\` reports steps, asks the user (\`confirm\`), writes output and carries the cancel signal;
	 * \`ctx.cancel()\` ends the job cancelled.${project ? "\n\t * JobService starts it only for an open project." : ""}
	 */
	async ${o.camel}(
		_input: HandlerInputOf<Operations["${op}"]>,
		_ctx: JobContext,
	): Promise<JobResultOf<"${op}">> {
		return {};
	}
`;
	if (project)
		return `
	/** Answers \`${op}\` for an open project (\`project.notOpen\` otherwise). */
	${o.camel}({
		projectId,
	}: HandlerInputOf<Operations["${op}"]>): HandlerResultOf<Operations["${op}"]> {
		this.#deps.scopes.require(projectId);
		return {};
	}
`;
	return `
	/** Answers \`${op}\`. */
	${o.camel}(): HandlerResultOf<Operations["${op}"]> {
		return {};
	}
`;
}

/** The lines `register` gains for one operation (a job's runner is given to JobService first). */
export function registerLines(x) {
	const { o, op, shape, project } = x;
	if (shape === "job")
		return `		this.#deps.jobs.define("${op}", (input, ctx) => this.${o.camel}(input, ctx));
		registry.handle("${op}", this.#deps.jobs.handler("${op}"));
`;
	return project
		? `		registry.handle("${op}", (input) => this.${o.camel}(input));
`
		: `		registry.handle("${op}", () => this.${o.camel}());
`;
}

/** A service's test file: a registry serving exactly what the service registers, over real core services. */
export const serviceTest = (
	f,
	runtimeImport,
) => `${comment(`${f.pascal}Service's tests: each operation it registers, answered through a real ServiceRegistry (input and output parsed against the contract, as the app serves them), with the core services behind it and a project the tests can open. The registry also serves the shared job and session operations and \`stream.read\`, so a test cancels a job (\`job.cancel\`) and reads its output as the renderer does; the clock is a FakeClock the tests move. Extend \`serve()\` to return anything else a test needs.`)}
import {
	type Contract,
	contract,
	type OperationMap,
	type StreamChunk,
} from "@ak-studio/contract";
${
	runtimeImport === "@ak-studio/runtime"
		? `import {
	EventBus,
	FakeClock,
	InMemoryJobRecordStore,
	JobService,
	ProjectScopes,
	SecretMasker,
	ServiceRegistry,
	SessionService,
	StreamHub,
} from "@ak-studio/runtime";
import { describe, expect, it, vi } from "vitest";`
		: `import { describe, expect, it, vi } from "vitest";
import { EventBus } from "../events";
import { JobService } from "../jobs";
import { FakeClock, InMemoryJobRecordStore } from "../ports/fakes";
import { ServiceRegistry } from "../registry";
import { ProjectScopes } from "../scope";
import { SecretMasker } from "../secrets";
import { SessionService } from "../sessions";
import { StreamHub } from "../streams";`
}
import { ${f.pascal}Service } from "./${f.pascal}Service";

/**
 * A started registry serving exactly what ${f.pascal}Service registers (and the shared job, session and stream
 * operations), the core services behind it, the FakeClock it waits on, and \`lines\`, which reads a stream.
 */
function serve() {
	const log = vi.fn();
	const masker = new SecretMasker();
	const events = new EventBus({ masker, log });
	const streams = new StreamHub({ masker, log });
	const scopes = new ProjectScopes({ masker, log });
	const jobs = new JobService({
		events,
		streams,
		scopes,
		records: new InMemoryJobRecordStore(),
		masker,
		log,
	});
	const sessions = new SessionService({ events, streams, scopes, masker, log });
	const clock = new FakeClock();
	const handlers = new Map<string, (input: never) => unknown>();
	new ${f.pascal}Service({
		app: { version: "1.2.3", platform: "linux" },
		clock,
		jobs,
		sessions,
		streams,
		events,
		scopes,
		masker,
	}).register({
		handle: (name, handler) => {
			handlers.set(name, handler as (input: never) => unknown);
		},
	});
	const names = [...handlers.keys()];
	// The shared operations the renderer answers, cancels, starts and stops with (job.cancel, jobs.list, ...).
	const core = new Map<string, (input: never) => unknown>();
	const collect = {
		handle: (name: string, handler: (input: never) => unknown) => {
			core.set(name, handler);
		},
	};
	jobs.register(collect as never);
	sessions.register(collect as never);
	const served: Contract = {
		operations: Object.fromEntries(
			[...names, ...core.keys()].map((name) => [
				name,
				contract.operations[name as keyof typeof contract.operations],
			]),
		) as OperationMap,
		streams: { "stream.read": contract.streams["stream.read"] },
	};
	const registry = new ServiceRegistry({ contract: served, masker, log });
	for (const [name, handler] of [...handlers, ...core])
		registry.handle(name, handler as never);
	streams.register(registry as never);
	registry.start();
	/** The lines of a stream so far (a job's or session's \`streamId\`), read as the renderer reads them. */
	const lines = async (streamId: string | undefined): Promise<string[]> => {
		const texts: string[] = [];
		let batches = 0;
		registry.subscribe("stream.read", { streamId }, (message) => {
			if (!message.ok) throw new Error(message.error.code);
			batches += 1;
			for (const chunk of (message.event as { chunks: StreamChunk[] }).chunks)
				texts.push(chunk.text);
		});
		await vi.waitFor(() => expect(batches).toBeGreaterThan(0));
		return texts;
	};
	return {
		registry,
		jobs,
		sessions,
		streams,
		events,
		scopes,
		clock,
		lines,
		names,
	};
}

describe("${f.pascal}Service", () => {
	it("registers the ${f.title} feature's operations, and no other", () => {
		const { names } = serve();
		expect(names.length).toBeGreaterThan(0);
		for (const name of names) expect(name.startsWith("${f.kebab}.")).toBe(true);
	});

	it("serves the shared job and session operations beside them", async () => {
		const { registry } = serve();
		expect(await registry.request("jobs.list", {})).toEqual({
			ok: true,
			value: { jobs: [] },
		});
	});
});
`;

/** The test a service gains for one operation. */
export function serviceCase(x) {
	const { op, shape, project } = x;
	const open = project
		? `
		scopes.open("${PROJECT}", { root: "/projects/${PROJECT}" });`
		: "";
	if (shape === "job")
		return `
	it("runs one ${op} job${project ? " for an open project" : ""} to its result", async () => {
		const { registry, jobs${project ? ", scopes" : ""} } = serve();${open}
		const started = await registry.request("${op}", ${input(x)});
		expect(started).toMatchObject({
			ok: true,
			value: { jobId: expect.any(String) },
		});
		await vi.waitFor(() =>
			expect(jobs.list()[0]?.state).toBe("succeeded"),
		);
		expect(jobs.list()[0]?.result).toEqual({});
	});
`;
	if (project)
		return `
	it("answers ${op} for an open project, and refuses a closed one", async () => {
		const { registry, scopes } = serve();
		expect(await registry.request("${op}", ${input(x)})).toMatchObject({
			ok: false,
			error: { code: "project.notOpen" },
		});${open}
		expect(await registry.request("${op}", ${input(x)})).toEqual({
			ok: true,
			value: {},
		});
	});
`;
	return `
	it("answers ${op}", async () => {
		const { registry } = serve();
		expect(await registry.request("${op}", {})).toEqual({
			ok: true,
			value: {},
		});
	});
`;
}

/** The mock's fixture answer for a desktop-only operation (desktopFixtures.ts); a project-scoped one checks the scope. */
export function fixture(x) {
	return x.project
		? `\t"${x.op}": ({ projectId }, { scopes }) => {
		scopes.require(projectId);
		return {};
	},
`
		: `\t"${x.op}": () => ({}),
`;
}

// ---- The feature's hook: apps/renderer/src/features/<feature>/api/use<Feature><Name>.ts ----

export function hook(x) {
	const { f, o, op, shape, project } = x;
	const name = `use${f.pascal}${o.pascal}`;
	if (shape === "query")
		return `${comment(`${name}: reads \`${op}\` into the query cache under the ${f.title} feature's keys (keys.ts${project ? ", one entry per project" : ""}), through the shared query hook (a pending state after 300 ms; failures as StudioFailure).`)}
${project ? 'import type { ProjectId } from "@ak-studio/contract";\n' : ""}import {
	type StudioQueryResult,
	useStudioQuery,
} from "../../../shared/query/hooks";
import { ${f.camel}Keys } from "./keys";

/** ${f.title}: ${o.title.toLowerCase()}. */
export function ${name}(${project ? "projectId: ProjectId" : ""}): StudioQueryResult<"${op}"> {
	return useStudioQuery(
		"${op}",
		${project ? "{ projectId }" : "{}"},
		{ key: ${project ? `${f.camel}Keys.detail(projectId, "${o.camel}")` : `${f.camel}Keys.app("${o.camel}")`} },
	);
}
`;
	if (shape === "command")
		return `${comment(`${name}: runs \`${op}\` through the shared mutation hook (a pending state after 300 ms; failures as StudioFailure). What it changes comes back through a domain event or its onSuccess, never an optimistic write.${project ? " Its input names the project, which must be open." : ""}`)}
import {
	type StudioMutationOptions,
	type StudioMutationResult,
	useStudioMutation,
} from "../../../shared/query/hooks";

/** ${f.title}: ${o.title.toLowerCase()}. */
export function ${name}(
	options: StudioMutationOptions<"${op}"> = {},
): StudioMutationResult<"${op}"> {
	return useStudioMutation("${op}", options);
}
`;
	return `${comment(`${name}: starts \`${op}\` jobs. \`start\` answers the job's id at once; its states arrive as events, read with \`useJob(jobId)\` (shared/jobs/jobStore.ts).${project ? " Its input names the project, which must be open." : ""}`)}
import { type StartJob, useStartJob } from "../../../shared/jobs/jobStore";

/** ${f.title}: ${o.title.toLowerCase()}. */
export function ${name}(): StartJob<"${op}"> {
	return useStartJob("${op}");
}
`;
}

export function hookTest(x) {
	const { f, o, op, shape, project } = x;
	const name = `use${f.pascal}${o.pascal}`;
	const header = `${comment(`${name}'s test: the hook calls \`${op}\` through the mock transport, which serves it as the app does (the feature's service behind a real registry, or its fixture for a desktop-only service).${project ? " The project is opened in the mock first." : ""}`)}
`;
	const backend = `		const backend = createMockBackend();${
		project
			? `
		backend.scopes.open("${PROJECT}", { root: MOCK_PROJECT_ROOT });`
			: ""
	}
		setTransport(backend.transport);`;
	const mockImport = `import {
	createMockBackend,${project ? "\n\tMOCK_PROJECT_ROOT," : ""}
} from "../../../shared/bridge/mockTransport";`;
	if (shape === "job")
		return `${header}import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { setTransport } from "../../../shared/bridge/client";
${mockImport}
import { ${name} } from "./${name}";

afterEach(() => {
	setTransport(undefined);
});

describe("${name}", () => {
	it("starts one ${op} job, which runs to its result", async () => {
${backend}
		const { result } = renderHook(() => ${name}());
		const jobId = await result.current.start(${input(x)});
		await waitFor(() =>
			expect(backend.jobs.list().find((job) => job.id === jobId)?.state).toBe(
				"succeeded",
			),
		);
	});
});
`;
	const imports = `import { QueryClientProvider } from "@tanstack/react-query";
import { ${shape === "command" ? "act, " : ""}renderHook${shape === "query" ? ", waitFor" : ""} } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { setTransport } from "../../../shared/bridge/client";
${mockImport}
import { createQueryClient } from "../../../shared/query/client";
import { ${name} } from "./${name}";

afterEach(() => {
	setTransport(undefined);
});

function withQueries() {
	const client = createQueryClient();
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
}
`;
	if (shape === "query")
		return `${header}${imports}
describe("${name}", () => {
	it("reads ${op}", async () => {
${backend}
		const { result } = renderHook(() => ${name}(${project ? JSON.stringify(PROJECT) : ""}), {
			wrapper: withQueries(),
		});
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual({});
	});${
		project
			? `

	it("refuses ${op} for a project that is not open", async () => {
		setTransport(createMockBackend().transport);
		const { result } = renderHook(() => ${name}(${JSON.stringify(PROJECT)}), {
			wrapper: withQueries(),
		});
		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(result.current.error?.error.code).toBe("project.notOpen");
	});`
			: ""
	}
});
`;
	return `${header}${imports}
describe("${name}", () => {
	it("writes with ${op}", async () => {
${backend}
		const { result } = renderHook(() => ${name}(), {
			wrapper: withQueries(),
		});
		await act(async () => {
			await expect(result.current.mutateAsync(${input(x)})).resolves.toEqual({});
		});
	});
});
`;
}
