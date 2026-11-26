// Templates for `pnpm new:operation <feature> <name> --shape query|command|job [--desktop]`: the contract
// declaration, the service that handles it (in packages/runtime, or apps/desktop with --desktop), its test, and the
// feature's hook and the hook's test. `f` is the feature's names and `o` the operation's (lib.mjs's `namesOf`);
// `op` is the operation's full name, `<feature>.<camelCaseName>`. The first operation of a feature creates the
// contract file and the service; later ones are added to them (new-operation.mjs).
import { comment } from "../lib.mjs";

/** What each shape is, in the declaration's doc comment (architecture.md, The contract). */
const SHAPE_DOC = {
	query: "a query: reads state, with no side effects",
	command: "a command: one write that finishes in under a second",
	job: "a job: slow or stepped work that ends with a result",
};

// ---- packages/contract/src/<feature>.ts ----

export const contractFile = (
	f,
) => `${comment(`The ${f.title} feature's operations (architecture.md, The contract), collected into \`operations\` in operations.ts. Builders come from ./shapes, never ./operations (that would be an import cycle). Inputs are strict objects; outputs are plain objects, so undeclared fields are stripped before they cross the bridge.`)}
import "./zodConfig";
import { z } from "zod";
`;

export function declaration(f, o, op, shape) {
	const doc = `/** ${f.title}: ${o.title.toLowerCase()} (${SHAPE_DOC[shape]}). */`;
	const name = `${f.camel}${o.pascal}`;
	if (shape === "job")
		return `
${doc}
export const ${name} = job({
	name: "${op}",
	input: z.strictObject({}),
	result: z.object({}),
	title: "${o.title}",
	cancellable: true,
	survivesQuit: false,
});
`;
	return `
${doc}
export const ${name} = ${shape}({
	name: "${op}",
	input: z.strictObject({}),
	output: z.object({}),
});
`;
}

// ---- The runtime service: packages/runtime/src/<feature>/<Feature>Service.ts ----

export const runtimeService = (
	f,
) => `${comment(`${f.pascal}Service: serves the ${f.title} feature's operations (architecture.md, Main-process services). It is browser-safe, like the rest of packages/runtime, so the desktop app and the browser's mock transport serve it alike (P1b-plan ruling 9); it is listed in ../features.ts. Each operation's handler is a method, and \`register\` wires them; a job's runner is given to JobService there.`)}
import type { FeatureRegistry, FeatureService } from "../features";

export class ${f.pascal}Service implements FeatureService {
	register(registry: FeatureRegistry): void {
	}
}
`;

export const runtimeServiceTest = (
	f,
) => `${comment(`${f.pascal}Service's tests: each operation it registers, answered through a real ServiceRegistry (input and output parsed against the contract, as the app serves them), with JobService behind its jobs.`)}
import {
	type Contract,
	contract,
	type OperationMap,
} from "@ak-studio/contract";
import { describe, expect, it, vi } from "vitest";
import { EventBus } from "../events";
import { JobService } from "../jobs";
import { InMemoryJobRecordStore } from "../ports/fakes";
import { ServiceRegistry } from "../registry";
import { ProjectScopes } from "../scope";
import { SecretMasker } from "../secrets";
import { SessionService } from "../sessions";
import { StreamHub } from "../streams";
import { ${f.pascal}Service } from "./${f.pascal}Service";

/** A started registry serving exactly what ${f.pascal}Service registers, and the JobService behind it. */
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
	const handlers = new Map<string, (input: never) => unknown>();
	new ${f.pascal}Service().register({
		handle: (name, handler) => {
			handlers.set(name, handler as (input: never) => unknown);
		},
		jobs,
		sessions,
		events,
		scopes,
	});
	const served: Contract = {
		operations: Object.fromEntries(
			[...handlers.keys()].map((name) => [
				name,
				contract.operations[name as keyof typeof contract.operations],
			]),
		) as OperationMap,
		streams: {},
	};
	const registry = new ServiceRegistry({ contract: served, masker, log });
	for (const [name, handler] of handlers)
		registry.handle(name, handler as never);
	registry.start();
	return { registry, jobs, names: [...handlers.keys()] };
}

describe("${f.pascal}Service", () => {
	it("registers the ${f.title} feature's operations, and no other", () => {
		const { names } = serve();
		expect(names.length).toBeGreaterThan(0);
		for (const name of names) expect(name.startsWith("${f.kebab}.")).toBe(true);
	});
});
`;

/** The handler method (or, for a job, the runner) the service gains for one operation. */
export function serviceMethod(o, op, shape) {
	if (shape === "job")
		return `
	/** Runs a \`${op}\` job; its answer is the job's result. */
	async ${o.camel}(): Promise<JobResultOf<"${op}">> {
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
export function registerLines(o, op, shape) {
	if (shape === "job")
		return `		registry.jobs.define("${op}", () => this.${o.camel}());
		registry.handle("${op}", registry.jobs.handler("${op}"));
`;
	return `		registry.handle("${op}", () => this.${o.camel}());
`;
}

/** The test a runtime service gains for one operation. */
export function runtimeServiceCase(op, shape) {
	if (shape === "job")
		return `
	it("runs a ${op} job to its result", async () => {
		const { registry, jobs } = serve();
		const started = await registry.request("${op}", {});
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

// ---- The desktop service: apps/desktop/src/main/services/<Feature>Service.ts (--desktop) ----

export const desktopService = (
	f,
) => `${comment(`${f.pascal}Service: serves the ${f.title} feature's operations that need Node or Electron (architecture.md, Main-process services), registered in registerServices.ts. The browser's mock transport answers the same operations from fixtures (apps/renderer/src/shared/bridge/desktopFixtures.ts). Each operation's handler is a method, and \`register\` wires them. No Electron import: index.ts passes Electron's values in.`)}
import type { Operations } from "@ak-studio/contract";
import type { RequestRegistrar, Service } from "@ak-studio/runtime";

export class ${f.pascal}Service implements Service {
	register(registry: RequestRegistrar<Operations>): void {
	}
}
`;

export const desktopServiceTest = (
	f,
) => `${comment(`${f.pascal}Service's tests: each operation it registers, answered through a real ServiceRegistry (input and output parsed against the contract, as the app serves them).`)}
import {
	type Contract,
	contract,
	type OperationMap,
} from "@ak-studio/contract";
import { ServiceRegistry } from "@ak-studio/runtime";
import { describe, expect, it, vi } from "vitest";
import { ${f.pascal}Service } from "./${f.pascal}Service";

/** A started registry serving exactly what ${f.pascal}Service registers. */
function serve() {
	const log = vi.fn();
	const handlers = new Map<string, (input: never) => unknown>();
	new ${f.pascal}Service().register({
		handle: (name, handler) => {
			handlers.set(name, handler as (input: never) => unknown);
		},
	});
	const served: Contract = {
		operations: Object.fromEntries(
			[...handlers.keys()].map((name) => [
				name,
				contract.operations[name as keyof typeof contract.operations],
			]),
		) as OperationMap,
		streams: {},
	};
	const registry = new ServiceRegistry({ contract: served, log });
	for (const [name, handler] of handlers)
		registry.handle(name, handler as never);
	registry.start();
	return { registry, names: [...handlers.keys()] };
}

describe("${f.pascal}Service", () => {
	it("registers the ${f.title} feature's operations, and no other", () => {
		const { names } = serve();
		expect(names.length).toBeGreaterThan(0);
		for (const name of names) expect(name.startsWith("${f.kebab}.")).toBe(true);
	});
});
`;

// ---- The feature's hook: apps/renderer/src/features/<feature>/api/use<Feature><Name>.ts ----

export function hook(f, o, op, shape) {
	const name = `use${f.pascal}${o.pascal}`;
	if (shape === "query")
		return `${comment(`${name}: reads \`${op}\` into the query cache under the ${f.title} feature's keys (keys.ts), through the shared query hook (a pending state after 300 ms; failures as StudioFailure).`)}
import {
	type StudioQueryResult,
	useStudioQuery,
} from "../../../shared/query/hooks";
import { ${f.camel}Keys } from "./keys";

/** ${f.title}: ${o.title.toLowerCase()}. */
export function ${name}(): StudioQueryResult<"${op}"> {
	return useStudioQuery(
		"${op}",
		{},
		{ key: ${f.camel}Keys.app("${o.camel}") },
	);
}
`;
	if (shape === "command")
		return `${comment(`${name}: runs \`${op}\` through the shared mutation hook (a pending state after 300 ms; failures as StudioFailure). What it changes comes back through a domain event or its onSuccess, never an optimistic write.`)}
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
	return `${comment(`${name}: starts \`${op}\` jobs. \`start\` answers the job's id at once; its states arrive as events, read with \`useJob(jobId)\` (shared/jobs/jobStore.ts).`)}
import { type StartJob, useStartJob } from "../../../shared/jobs/jobStore";

/** ${f.title}: ${o.title.toLowerCase()}. */
export function ${name}(): StartJob<"${op}"> {
	return useStartJob("${op}");
}
`;
}

export function hookTest(f, o, op, shape) {
	const name = `use${f.pascal}${o.pascal}`;
	const header = `${comment(`${name}'s test: the hook calls \`${op}\` through the mock transport, which serves it as the app does (the feature's service behind a real registry, or its fixture for a desktop-only service).`)}
`;
	if (shape === "job")
		return `${header}import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { setTransport } from "../../../shared/bridge/client";
import { createMockBackend } from "../../../shared/bridge/mockTransport";
import { ${name} } from "./${name}";

afterEach(() => {
	setTransport(undefined);
});

describe("${name}", () => {
	it("starts a ${op} job, which runs to its result", async () => {
		const backend = createMockBackend();
		setTransport(backend.transport);
		const { result } = renderHook(() => ${name}());
		const jobId = await result.current.start({});
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
import { createMockTransport } from "../../../shared/bridge/mockTransport";
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
		setTransport(createMockTransport());
		const { result } = renderHook(() => ${name}(), {
			wrapper: withQueries(),
		});
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual({});
	});
});
`;
	return `${header}${imports}
describe("${name}", () => {
	it("writes with ${op}", async () => {
		setTransport(createMockTransport());
		const { result } = renderHook(() => ${name}(), {
			wrapper: withQueries(),
		});
		await act(async () => {
			await expect(result.current.mutateAsync({})).resolves.toEqual({});
		});
	});
});
`;
}
