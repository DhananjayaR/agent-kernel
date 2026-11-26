// The session operations: start a session of a declared kind, stop it, list the sessions.
import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "./errors";
import { sessionStart, sessionStop, sessionsList } from "./sessions";

describe("session operations", () => {
	it("are named and shaped as the plan says", () => {
		expect(
			[sessionStart, sessionStop, sessionsList].map((op) => [
				op.name,
				op.shape,
			]),
		).toEqual([
			["session.start", "command"],
			["session.stop", "command"],
			["sessions.list", "query"],
		]);
	});

	it("session.start takes a kind, an optional projectId and args, and answers { sessionId }", () => {
		const input = { kind: "run.server", projectId: "p1", args: { port: 1 } };
		expect(sessionStart.input.parse(input)).toEqual(input);
		expect(sessionStart.input.parse({ kind: "run.server", args: {} })).toEqual({
			kind: "run.server",
			args: {},
		});
		for (const bad of [
			{ ...input, extra: 1 },
			{ ...input, kind: "" },
			{ ...input, projectId: "" },
		]) {
			expect(sessionStart.input.safeParse(bad).success).toBe(false);
		}
		expect(sessionStart.output.parse({ sessionId: "s1", extra: 1 })).toEqual({
			sessionId: "s1",
		});
		expect(sessionStart.errors).toEqual([
			ERROR_CODES.projectNotOpen,
			ERROR_CODES.sessionUnknownKind,
			ERROR_CODES.sessionAlreadyRunning,
			ERROR_CODES.sessionFailed,
		]);
	});

	it("session.stop takes a strict { sessionId }; sessions.list answers { sessions }", () => {
		expect(sessionStop.input.parse({ sessionId: "s1" })).toEqual({
			sessionId: "s1",
		});
		expect(sessionStop.input.safeParse({ sessionId: "s1", x: 1 }).success).toBe(
			false,
		);
		expect(sessionStop.errors).toEqual([ERROR_CODES.sessionNotFound]);
		const session = {
			id: "s1",
			kind: "run.server",
			state: "running",
			commandIds: [],
		};
		expect(sessionsList.input.safeParse({ extra: 1 }).success).toBe(false);
		expect(sessionsList.output.parse({ sessions: [session] })).toEqual({
			sessions: [session],
		});
	});
});
