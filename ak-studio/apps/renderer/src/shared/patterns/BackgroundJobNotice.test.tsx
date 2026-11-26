// The background job notice over the job store: which changes raise a toast (one the window saw, while the owner
// was off screen), what the tab icon says and when it goes, and the waiting toast closing once answered. Jobs are put
// in the store as the events would; the toast queue is the design system's, read back with `visibleToasts`.
import type { Job } from "@ak-studio/contract";
import { createToastQueue, type ToastQueue } from "@ak-studio/ui";
import { act, render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyJobs, useJobStore } from "../jobs/jobStore";
import {
	type BackgroundJobNoticeOptions,
	ownerOf,
	useBackgroundJobNotice,
} from "./BackgroundJobNotice";

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

let seq = 1;
/** The job's next state, as a job.updated event brings it. */
function becomes(state: Job["state"], extra: Partial<Job> = {}) {
	seq += 1;
	act(() => applyJobs([{ ...running, ...extra, state, seq }]));
}

let toasts: ToastQueue;
const show = vi.fn();

function setup(options: Partial<BackgroundJobNoticeOptions> = {}) {
	const props: BackgroundJobNoticeOptions = {
		toasts,
		onScreen: "canvas",
		tabs: ["canvas", "deploy"],
		showCommand: (feature) => (feature === "deploy" ? show : undefined),
		...options,
	};
	return renderHook(
		(p: BackgroundJobNoticeOptions) => useBackgroundJobNotice(p),
		{
			initialProps: props,
		},
	);
}

/** The tab icon's event and name, as DesktopShell would show it. */
function icon(node: ReactNode) {
	if (!node) return undefined;
	const { container, unmount } = render(<>{node}</>);
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
	seq = 1;
	show.mockClear();
	toasts = createToastQueue();
	useJobStore.setState({ jobs: {} });
	applyJobs([running]);
});

describe("ownerOf", () => {
	it("is the namespace of the job's kind", () => {
		expect(ownerOf({ kind: "about.demoJob" })).toBe("about");
	});
});

describe("useBackgroundJobNotice", () => {
	it("a job that finishes off screen: a success toast with Show, and the finished icon on its tab", () => {
		const { result } = setup();
		becomes("succeeded");
		expect(titles()).toEqual(["Apply finished"]);
		const toast = toasts.visibleToasts[0]?.content;
		expect(toast?.tone).toBe("success");
		toast?.action?.onAction();
		expect(show).toHaveBeenCalledOnce();
		expect(icon(result.current.deploy)).toEqual({
			event: "finished",
			name: "Finished",
		});
	});

	it("a failure says what happened; the icon goes when the person opens the tab", () => {
		const { result, rerender } = setup();
		becomes("failed", {
			error: {
				code: "internal",
				message: "terraform apply exited with code 1.",
			},
		});
		expect(toasts.visibleToasts[0]?.content).toMatchObject({
			tone: "danger",
			title: "Apply failed",
			description: "terraform apply exited with code 1.",
		});
		expect(icon(result.current.deploy)?.event).toBe("failed");
		rerender({
			toasts,
			onScreen: "deploy",
			tabs: ["canvas", "deploy"],
			showCommand: () => show,
		});
		expect(result.current.deploy).toBeUndefined();
	});

	it("a job waiting for an answer: an info toast naming the question, and an icon that stays until it is answered", () => {
		const { result, rerender } = setup();
		becomes("waiting-for-user", {
			request: {
				id: "r1",
				kind: "confirm-by-name",
				title: "Apply this plan?",
				summary: "Creates 12 resources.",
				affects: [],
			},
		});
		expect(toasts.visibleToasts[0]?.content).toMatchObject({
			tone: "info",
			title: "Apply is waiting for you",
			description: "Apply this plan?",
		});
		expect(icon(result.current.deploy)).toEqual({
			event: "waiting",
			name: "Needs your answer",
		});
		// Opening the tab does not clear it: the question is still open.
		rerender({
			toasts,
			onScreen: "deploy",
			tabs: ["canvas", "deploy"],
			showCommand: () => show,
		});
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

	it("a feature with no tab gets the toast only; one with no show command gets no Show", () => {
		const { result } = setup({
			tabs: ["canvas"],
			showCommand: () => undefined,
		});
		becomes("succeeded");
		expect(titles()).toEqual(["Apply finished"]);
		expect(toasts.visibleToasts[0]?.content.action).toBeUndefined();
		expect(result.current.deploy).toBeUndefined();
	});
});
