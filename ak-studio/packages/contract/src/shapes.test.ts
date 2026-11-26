// The four shapes: each builder layers on defineOperation (a request) and adds its shape, error codes and
// capability; `job` answers `{ jobId }` and carries its result schema; a session kind is not an operation.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ERROR_CODES } from "./errors";
import {
	command,
	defineOperation,
	defineSessionKind,
	job,
	jobStartedSchema,
	query,
} from "./shapes";

const input = z.strictObject({ projectId: z.string() });
const output = z.object({ value: z.number() });

describe("query and command", () => {
	it("are requests with their shape, an empty error list and no capability by default", () => {
		for (const [build, shape] of [
			[query, "query"],
			[command, "command"],
		] as const) {
			const op = build({ name: "t.op", input, output });
			expect(op.kind).toBe("request");
			expect(op.name).toBe("t.op");
			expect(op.input).toBe(input);
			expect(op.output).toBe(output);
			expect(op.shape).toBe(shape);
			expect(op.errors).toEqual([]);
			expect("capability" in op).toBe(false);
			expect(Object.isFrozen(op)).toBe(true);
			expect(Object.isFrozen(op.errors)).toBe(true);
		}
	});

	it("keep the error codes and capability they are given", () => {
		const errors = [ERROR_CODES.projectNotOpen, ERROR_CODES.fileChangedOnDisk];
		const op = command({
			name: "t.write",
			input,
			output,
			errors,
			capability: "config.sections",
		});
		expect(op.errors).toEqual(errors);
		expect(op.errors).not.toBe(errors);
		expect(op.capability).toBe("config.sections");
	});

	it("leave the input strict and the output stripping", () => {
		const op = query({ name: "t.read", input, output });
		expect(op.input.safeParse({ projectId: "p", extra: 1 }).success).toBe(
			false,
		);
		expect(op.output.parse({ value: 1, extra: 1 })).toEqual({ value: 1 });
	});

	it("match what defineOperation builds, plus the shape fields", () => {
		const plain = defineOperation({ name: "t.op", input, output });
		const shaped = query({ name: "t.op", input, output });
		expect(shaped).toMatchObject(plain);
		expect("shape" in plain).toBe(false);
	});
});

describe("job", () => {
	const result = z.object({ path: z.string() });
	const create = job({
		name: "t.create",
		input,
		result,
		errors: [ERROR_CODES.projectNotOpen],
		title: "Create the project",
		cancellable: true,
		survivesQuit: false,
	});

	it("is a request of shape job that answers { jobId }", () => {
		expect(create.kind).toBe("request");
		expect(create.shape).toBe("job");
		expect(create.output).toBe(jobStartedSchema);
		expect(create.output.parse({ jobId: "j1", extra: 1 })).toEqual({
			jobId: "j1",
		});
		expect(create.output.safeParse({}).success).toBe(false);
		expect(create.output.safeParse({ jobId: "" }).success).toBe(false);
	});

	it("carries its result schema and the job fields", () => {
		expect(create.result).toBe(result);
		expect(create.title).toBe("Create the project");
		expect(create.cancellable).toBe(true);
		expect(create.survivesQuit).toBe(false);
		expect(create.errors).toEqual([ERROR_CODES.projectNotOpen]);
		expect(create.input).toBe(input);
		expect(Object.isFrozen(create)).toBe(true);
	});

	it("defaults to no errors and no capability", () => {
		const plain = job({
			name: "t.plain",
			input,
			result,
			title: "Plain",
			cancellable: false,
			survivesQuit: true,
		});
		expect(plain.errors).toEqual([]);
		expect("capability" in plain).toBe(false);
		expect(plain.survivesQuit).toBe(true);
	});
});

describe("defineSessionKind", () => {
	it("declares a session kind with its args, info and errors", () => {
		const args = z.strictObject({ port: z.int() });
		const info = z.object({ url: z.string() });
		const kind = defineSessionKind({
			kind: "t.server",
			args,
			info,
			errors: [ERROR_CODES.sessionFailed],
		});
		expect(kind).toEqual({
			shape: "session",
			kind: "t.server",
			args,
			info,
			errors: [ERROR_CODES.sessionFailed],
		});
		expect(Object.isFrozen(kind)).toBe(true);
		expect(kind.args.safeParse({ port: 1, extra: 1 }).success).toBe(false);
		expect(defineSessionKind({ kind: "t.bare", args, info }).errors).toEqual(
			[],
		);
	});
});
