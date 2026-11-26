// The job store: newest state by `seq`, one job per view (a progress update on job A does not re-render a view
// of job B), and the calls that start, answer and cancel jobs. The app's contract declares no job kind in P1b, so
// starting one goes through a recording transport; answering and cancelling go through the mock's JobService.
import {
	ERROR_CODES,
	type Job,
	type JobKindName,
	type Transport,
} from "@ak-studio/contract";
import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isStudioFailure, setTransport } from "../bridge/client";
import { createMockBackend } from "../bridge/mockTransport";
import {
	applyJobs,
	cancelJob,
	respondToJob,
	useJob,
	useJobStore,
	useStartJob,
} from "./jobStore";

const job = (id: string, seq: number, extra: Partial<Job> = {}): Job => ({
	id,
	kind: "t.demo",
	title: `Job ${id}`,
	state: "running",
	commandIds: [],
	cancellable: true,
	survivesQuit: false,
	seq,
	...extra,
});

beforeEach(() => {
	useJobStore.setState({ jobs: {} });
});
afterEach(() => {
	setTransport(undefined);
});

describe("applyJobs", () => {
	it("keeps the newest state of each job by seq, in one store update", () => {
		const updates = vi.fn();
		const unsubscribe = useJobStore.subscribe(updates);
		applyJobs([job("a", 2), job("b", 1), job("a", 1, { state: "queued" })]);
		expect(updates).toHaveBeenCalledOnce();
		expect(useJobStore.getState().jobs).toEqual({
			a: job("a", 2),
			b: job("b", 1),
		});
		// Nothing newer: no update at all.
		applyJobs([job("a", 2), job("b", 0)]);
		expect(updates).toHaveBeenCalledOnce();
		applyJobs([job("b", 3, { state: "succeeded" })]);
		expect(useJobStore.getState().jobs.b?.state).toBe("succeeded");
		unsubscribe();
	});
});

/** One job's row: it reports each render. */
function JobRow({ id, onRender }: { id: string; onRender: () => void }) {
	onRender();
	const shown = useJob(id);
	return (
		<p data-testid={id}>
			{shown ? `${shown.state} ${shown.progress?.step ?? 0}` : "none"}
		</p>
	);
}

describe("useJob", () => {
	it("re-renders a view only when its own job changes", () => {
		applyJobs([job("a", 1), job("b", 1)]);
		const rendersA = vi.fn();
		const rendersB = vi.fn();
		render(
			<>
				<JobRow id="a" onRender={rendersA} />
				<JobRow id="b" onRender={rendersB} />
			</>,
		);
		expect(rendersA).toHaveBeenCalledOnce();
		expect(rendersB).toHaveBeenCalledOnce();
		act(() => {
			applyJobs([
				job("a", 2, { progress: { step: 1, steps: 3, label: "Checking" } }),
			]);
		});
		expect(screen.getByTestId("a").textContent).toBe("running 1");
		expect(rendersA).toHaveBeenCalledTimes(2);
		expect(rendersB).toHaveBeenCalledOnce();
	});

	it("answers undefined for a job the store does not have, or no id", () => {
		const { result, rerender } = renderHook(
			({ id }: { id: string | undefined }) => useJob(id),
			{ initialProps: { id: "missing" as string | undefined } },
		);
		expect(result.current).toBeUndefined();
		rerender({ id: undefined });
		expect(result.current).toBeUndefined();
	});
});

describe("useStartJob", () => {
	it("calls the job's operation with the input and answers the job id", async () => {
		const request = vi.fn(async () => ({ jobId: "job-7" }));
		setTransport({
			request,
			subscribe: () => () => {},
		} as unknown as Transport);
		// No job kind is declared in P1b (Task 14 adds the first); any name stands in for one here.
		const name = "t.demo" as JobKindName;
		const { result, rerender } = renderHook(() => useStartJob(name));
		const first = result.current;
		await expect(
			result.current.start({ projectId: "p1" } as never),
		).resolves.toBe("job-7");
		expect(request).toHaveBeenCalledExactlyOnceWith("t.demo", {
			projectId: "p1",
		});
		rerender();
		// The same object across renders, so it can sit in effect dependencies.
		expect(result.current).toBe(first);
	});
});

describe("respondToJob and cancelJob", () => {
	it("send job.respond and job.cancel, and reject with the StudioFailure the service answers", async () => {
		const backend = createMockBackend();
		const request = vi.spyOn(backend.transport, "request");
		setTransport(backend.transport);
		const answer = { jobId: "nope", requestId: "request-1", answer: {} };
		const responded = await respondToJob(answer).catch((e: unknown) => e);
		expect(isStudioFailure(responded)).toBe(true);
		expect((responded as { error: { code: string } }).error.code).toBe(
			ERROR_CODES.jobNotFound,
		);
		const cancelled = await cancelJob("nope").catch((e: unknown) => e);
		expect((cancelled as { error: { code: string } }).error.code).toBe(
			ERROR_CODES.jobNotFound,
		);
		expect(request.mock.calls).toEqual([
			["job.respond", answer],
			["job.cancel", { jobId: "nope" }],
		]);
	});
});
