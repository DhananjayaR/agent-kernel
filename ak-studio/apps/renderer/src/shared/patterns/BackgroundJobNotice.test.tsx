// The background job notice over the job store: which changes raise a toast (one the window saw, while the owner
// was off screen), what the tab icon says (by severity: waiting > failed > finished, whatever the order) and when it
// goes, the waiting toast that never times out and closes once answered, and owners that are declared, not guessed.
// Jobs are put in the store as the events would; the toast queue is the design system's, read back with
// `visibleToasts`.
import type { Job } from "@ak-studio/contract";
import {
	createToastQueue,
	TOAST_TIMEOUT_MS,
	type ToastQueue,
} from "@ak-studio/ui";
import { act, render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyJobs, useJobStore } from "../jobs/jobStore";
import {
	type BackgroundJobNoticeOptions,
	useBackgroundJobNotice,
} from "./BackgroundJobNotice";

/** Deploy owns these kinds (as its manifest would declare); nothing owns `orphan.run`. */
const OWNERS: Record<string, string> = {
	"deploy.apply": "deploy",
	"deploy.destroy": "deploy",
	"deploy.backend.create": "deploy",
};

const running: Job = {
	id: "job-1",
	kind: "deploy.apply",
	title: "Apply",
	state: "running",
	commandIds: [],
	cancellable: true,
	survivesQuit: true,
	seq: 1,
};

const seqs = new Map<string, number>();
/** A job's next state, as a job.updated event brings it. */
function update(job: Job, state: Job["state"], extra: Partial<Job> = {}) {
	const seq = (seqs.get(job.id) ?? job.seq) + 1;
	seqs.set(job.id, seq);
	act(() => applyJobs([{ ...job, ...extra, state, seq }]));
}
const becomes = (state: Job["state"], extra: Partial<Job> = {}) =>
	update(running, state, extra);

const ask = {
	id: "r1",
	kind: "confirm-by-name" as const,
	title: "Apply this plan?",
	summary: "Creates 12 resources.",
	affects: [],
};
const failure = { code: "bridge.internal", message: "Try again." };

let toasts: ToastQueue;
const show = vi.fn();

function options(
	extra: Partial<BackgroundJobNoticeOptions> = {},
): BackgroundJobNoticeOptions {
	return {
		toasts,
		onScreen: "canvas",
		tabs: ["canvas", "deploy"],
		ownerOf: (kind) => OWNERS[kind],
		showCommand: (feature) => (feature === "deploy" ? show : undefined),
		...extra,
	};
}

function setup(extra: Partial<BackgroundJobNoticeOptions> = {}) {
	return renderHook(
		(p: BackgroundJobNoticeOptions) => useBackgroundJobNotice(p),
		{ initialProps: options(extra) },
	);
}

/** The tab icon's event and name, as DesktopShell would show it. */
function icon(node: ReactNode) {
	if (!node) return undefined;
	const { container, unmount } = render(<div>{node}</div>);
	const el = container.querySelector("[data-job-event]");
	const out = {
		event: el?.getAttribute("data-job-event"),
		name: el?.textContent,
	};
	unmount();
	return out;
}

const titles = () => toasts.visibleToasts.map((toast) => toast.content.title);

beforeEach(() => {
	seqs.clear();
	show.mockClear();
	toasts = createToastQueue();
	useJobStore.setState({ jobs: {} });
	applyJobs([running]);
});

describe("useBackgroundJobNotice", () => {
	it("a job that finishes off screen: a success toast with Show, and the finished icon on its tab", () => {
		const { result } = setup();
		becomes("succeeded");
		expect(titles()).toEqual(["Apply finished"]);
		expect(toasts.visibleToasts[0]?.content.tone).toBe("success");
		expect(icon(result.current.deploy)).toEqual({
			event: "finished",
			name: "Finished",
		});
	});

	it("a failure says what happened (the catalogue's title), and its icon goes when the person opens the tab", () => {
		const { result, rerender } = setup();
		becomes("failed", { error: failure });
		expect(toasts.visibleToasts[0]?.content).toMatchObject({
			tone: "danger",
			title: "Apply failed",
			description: "An unexpected error stopped this action",
		});
		expect(icon(result.current.deploy)?.event).toBe("failed");
		rerender(options({ onScreen: "deploy" }));
		expect(result.current.deploy).toBeUndefined();
	});

	it("Show runs the owner's show command and clears the tab's ended notice", () => {
		const { result } = setup();
		becomes("failed", { error: failure });
		act(() => toasts.visibleToasts[0]?.content.action?.onAction());
		expect(show).toHaveBeenCalledOnce();
		expect(result.current.deploy).toBeUndefined();
	});

	it("a job waiting for an answer: an info toast naming the question, never timed out, and an icon that stays until it is answered", () => {
		const { result, rerender } = setup();
		becomes("waiting-for-user", { request: ask });
		expect(toasts.visibleToasts[0]?.content).toMatchObject({
			tone: "info",
			title: "Apply is waiting for you",
			description: "Apply this plan?",
			persistent: true,
		});
		expect(icon(result.current.deploy)).toEqual({
			event: "waiting",
			name: "Needs your answer",
		});
		// Opening the tab does not clear it: the question is still open.
		rerender(options({ onScreen: "deploy" }));
		expect(icon(result.current.deploy)?.event).toBe("waiting");
		// Answered: the icon goes and the waiting toast closes.
		becomes("running");
		expect(result.current.deploy).toBeUndefined();
		expect(titles()).toEqual([]);
	});

	it("raises nothing for a job whose feature is on screen", () => {
		const { result } = setup({ onScreen: "deploy" });
		becomes("succeeded");
		expect(titles()).toEqual([]);
		expect(result.current.deploy).toBeUndefined();
	});

	it("raises nothing for a cancelled job, or for jobs first seen already ended (a reload's list)", () => {
		setup();
		becomes("cancelled");
		act(() =>
			applyJobs([{ ...running, id: "job-old", state: "succeeded", seq: 9 }]),
		);
		expect(titles()).toEqual([]);
	});

	it("a feature with no tab gets the toast only; one with no show command gets no Show, and its waiting toast still never times out", () => {
		const { result } = setup({
			tabs: ["canvas"],
			showCommand: () => undefined,
		});
		becomes("waiting-for-user", { request: ask });
		const toast = toasts.visibleToasts[0];
		expect(toast?.content.action).toBeUndefined();
		expect(toast?.timeout).toBeUndefined();
		expect(result.current.deploy).toBeUndefined();
	});

	it("a job no manifest owns still gets its toast, with no Show and no icon (owners are declared, not guessed)", () => {
		const orphan: Job = { ...running, id: "job-o", kind: "orphan.run" };
		act(() => applyJobs([orphan]));
		const { result } = setup({ tabs: ["canvas", "deploy", "orphan"] });
		update(orphan, "succeeded");
		expect(titles()).toEqual(["Apply finished"]);
		expect(toasts.visibleToasts[0]?.content.action).toBeUndefined();
		// A finished toast with nothing to press times out, unlike a waiting one.
		expect(toasts.visibleToasts[0]?.timeout).toBe(TOAST_TIMEOUT_MS);
		expect(result.current.orphan).toBeUndefined();
	});
});

/** Every order of `items`. */
function orders<T>(items: readonly T[]): T[][] {
	if (items.length <= 1) return [[...items]];
	return items.flatMap((item, i) =>
		orders([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [
			item,
			...rest,
		]),
	);
}

type Outcome = "failed" | "succeeded" | "waiting-for-user";

/** Three jobs on the Deploy tab, each ending (or asking) in the given order, as separate events. */
function run(sequence: readonly Outcome[]) {
	const jobs: Job[] = sequence.map((_, i) => ({
		...running,
		id: `job-${i}`,
		kind: Object.keys(OWNERS)[i] as string,
	}));
	act(() => applyJobs(jobs));
	const hook = setup();
	sequence.forEach((outcome, i) => {
		update(jobs[i] as Job, outcome, {
			...(outcome === "failed" ? { error: failure } : {}),
			...(outcome === "waiting-for-user" ? { request: ask } : {}),
		});
	});
	return { ...hook, jobs };
}

const expected = (sequence: readonly Outcome[]) =>
	sequence.includes("waiting-for-user")
		? "waiting"
		: sequence.includes("failed")
			? "failed"
			: "finished";

describe("several jobs on one tab: the icon is by severity, not the last event", () => {
	const twos: Outcome[][] = [
		...orders<Outcome>(["failed", "succeeded"]),
		...orders<Outcome>(["failed", "waiting-for-user"]),
		...orders<Outcome>(["succeeded", "waiting-for-user"]),
	];
	for (const sequence of [
		...twos,
		...orders<Outcome>(["failed", "succeeded", "waiting-for-user"]),
	]) {
		it(`${sequence.join(", then ")}: ${expected(sequence)}`, () => {
			const { result } = run(sequence);
			expect(icon(result.current.deploy)?.event).toBe(expected(sequence));
		});
	}

	it("answering the waiting job falls back to the failure, which stays until the tab is opened", () => {
		const { result, rerender, jobs } = run([
			"failed",
			"waiting-for-user",
			"succeeded",
		]);
		update(jobs[1] as Job, "succeeded");
		expect(icon(result.current.deploy)?.event).toBe("failed");
		rerender(options({ onScreen: "deploy" }));
		expect(result.current.deploy).toBeUndefined();
	});
});
