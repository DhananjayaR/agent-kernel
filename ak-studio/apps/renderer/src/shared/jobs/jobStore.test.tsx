// The job store: newest state by `seq`, one job per view (a progress update on job A does not re-render a view
// of job B), and the calls that start, answer and cancel jobs. Starting one goes through a recording transport, to
// see the exact call; answering and cancelling go through the mock's JobService. A real job kind, started and
// followed with useJob over the mock's events, is tested in features/about/api/useAboutDemoJob.test.tsx.
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
	startJob,
	useJob,
	useJobIdsToShow,
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

describe("useJobIdsToShow", () => {
	it("answers the live jobs of the kinds and the newest whatever its state, oldest first", () => {
		const { result } = renderHook(() => useJobIdsToShow(["t.demo", "t.other"]));
		expect(result.current).toEqual([]);
		act(() => {
			applyJobs([
				job("a", 1, { state: "succeeded" }),
				job("b", 1, { state: "waiting-for-user" }),
				job("c", 1, { kind: "t.elsewhere" }),
				job("d", 1, { state: "failed", kind: "t.other" }),
			]);
		});
		// a ended and is not the newest; c is another kind; d ended but is the newest of the kinds.
		expect(result.current).toEqual(["b", "d"]);
		act(() => {
			applyJobs([job("e", 1, { state: "queued" })]);
		});
		// A new run: the ended d gives way to it.
		expect(result.current).toEqual(["b", "e"]);
		act(() => {
			applyJobs([job("b", 2, { state: "cancelled" })]);
		});
		expect(result.current).toEqual(["e"]);
	});

	it("keeps the same array while the list is unchanged", () => {
		applyJobs([job("a", 1)]);
		const { result } = renderHook(() => useJobIdsToShow(["t.demo"]));
		const first = result.current;
		act(() => {
			applyJobs([
				job("a", 2, { progress: { step: 1, steps: 3, label: "Checking" } }),
			]);
		});
		expect(result.current).toBe(first);
	});
});

describe("useStartJob", () => {
	it("calls the job's operation with the input and answers the job id", async () => {
		const request = vi.fn(async () => ({ jobId: "job-7" }));
		setTransport({
			request,
			subscribe: () => () => {},
		} as unknown as Transport);
		// A recording transport answers any name; this one stands in for a job kind.
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
		// Outside React (an app command), startJob makes the same call.
		await expect(startJob(name, { projectId: "p2" } as never)).resolves.toBe(
			"job-7",
		);
		expect(request).toHaveBeenLastCalledWith("t.demo", { projectId: "p2" });
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
