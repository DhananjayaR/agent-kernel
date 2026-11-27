// useAboutDemoJob's test: the hook calls `about.demoJob` through the mock transport, which serves it as the app
// does (the feature's service behind a real registry). The job is followed as a view follows it: `useJob` over the
// events subscription, `useStream` for its lines. The mock's clock is a FakeClock, so its one-second steps run when
// the test moves it. Also the Task 8 carry: useStartJob and useJob on a real job kind.
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FakeClock } from "../../../shared/bridge/mockTransport";
import { cancelJob, respondToJob, useJob } from "../../../shared/jobs/jobStore";
import { useStream } from "../../../shared/streams/streamStore";
import { type ConnectedMock, connectMock } from "../../../test/connectedMock";
import { useAboutDemoJob } from "./useAboutDemoJob";

const SECOND = 1000;

let mock: ConnectedMock | undefined;
afterEach(() => {
	mock?.dispose();
	mock = undefined;
});

/** Starts a demo job through the hook and follows it as a view does: its state and its lines. */
async function startDemo() {
	const clock = new FakeClock();
	mock = connectMock({ clock });
	const { result, rerender } = renderHook(
		({ jobId }: { jobId: string | undefined }) => {
			const job = useJob(jobId);
			return {
				start: useAboutDemoJob(),
				job,
				lines: useStream(job?.streamId).lines.map((chunk) => chunk.text),
			};
		},
		{
			wrapper: mock.wrapper,
			initialProps: { jobId: undefined as string | undefined },
		},
	);
	const jobId = await act(() => result.current.start.start({}));
	rerender({ jobId });
	await waitFor(() => expect(result.current.job?.progress?.step).toBe(1));
	/** Moves the clock on by `seconds`. */
	const wait = (seconds: number) => act(() => clock.advance(seconds * SECOND));
	return { result, jobId, wait, clock };
}

describe("useAboutDemoJob", () => {
	it("starts one about.demoJob job, which asks before its last step and succeeds once approved", async () => {
		const { result, jobId, wait } = await startDemo();
		expect(result.current.job).toMatchObject({
			kind: "about.demoJob",
			title: "Demo job",
			state: "running",
			cancellable: true,
			survivesQuit: false,
		});
		await wait(1);
		await waitFor(() => expect(result.current.job?.progress?.step).toBe(2));
		await wait(1);
		await waitFor(() =>
			expect(result.current.job?.state).toBe("waiting-for-user"),
		);
		const request = result.current.job?.request;
		expect(request).toMatchObject({
			kind: "confirm",
			title: "Run the last step?",
		});
		await act(() =>
			respondToJob({
				jobId,
				requestId: request?.id ?? "",
				answer: { optionId: "approve" },
			}),
		);
		await waitFor(() => expect(result.current.job?.progress?.step).toBe(3));
		await wait(1);
		await waitFor(() => expect(result.current.job?.state).toBe("succeeded"));
		expect(result.current.job?.result).toEqual({ steps: 3 });
		await waitFor(() =>
			expect(result.current.lines).toEqual([
				"Step 1 of 3: Checking the app",
				"Step 2 of 3: Preparing the demo",
				"Step 3 of 3: Finishing the demo",
			]),
		);
	});

	it("ends cancelled when the question is denied", async () => {
		const { result, jobId, wait } = await startDemo();
		await wait(2);
		await waitFor(() =>
			expect(result.current.job?.state).toBe("waiting-for-user"),
		);
		await act(() =>
			respondToJob({
				jobId,
				requestId: result.current.job?.request?.id ?? "",
				answer: { optionId: "deny" },
			}),
		);
		await waitFor(() => expect(result.current.job?.state).toBe("cancelled"));
		expect(result.current.job?.error).toBeUndefined();
		expect(result.current.job?.progress?.step).toBe(2);
	});

	it("refuses an answer that is not one of the request's options", async () => {
		const { result, jobId, wait } = await startDemo();
		await wait(2);
		await waitFor(() =>
			expect(result.current.job?.state).toBe("waiting-for-user"),
		);
		const refused = await respondToJob({
			jobId,
			requestId: result.current.job?.request?.id ?? "",
			answer: {},
		}).catch((err: { error: { code: string } }) => err.error.code);
		expect(refused).toBe("bridge.invalidInput");
		expect(result.current.job?.state).toBe("waiting-for-user");
	});

	it("ends cancelled when cancelled while it waits for an answer", async () => {
		const { result, jobId, wait, clock } = await startDemo();
		await wait(2);
		await waitFor(() =>
			expect(result.current.job?.state).toBe("waiting-for-user"),
		);
		await act(() => cancelJob(jobId));
		await waitFor(() => expect(result.current.job?.state).toBe("cancelled"));
		expect(result.current.job?.request).toBeUndefined();
		expect(clock.sleeping).toBe(0);
	});
});
