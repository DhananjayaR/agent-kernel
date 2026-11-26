// Approval over a job's open request: the frame rule (a card where the work happens, a modal for confirm-by-name or
// a destructive approve), the labels from the request's options, and the answers it sends through job.respond. The
// transport is a stub that records each request, so the exact answer is checked; the job is put in the store.
import { type Job, StudioFailure, type Transport } from "@ak-studio/contract";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setTransport } from "../bridge/client";
import { applyJobs, useJob, useJobStore } from "../jobs/jobStore";
import { Approval, approvalFrame, approvalOptions } from "./Approval";

const confirm: Job = {
	id: "job-1",
	kind: "about.demoJob",
	title: "Demo job",
	state: "waiting-for-user",
	request: {
		id: "req-1",
		kind: "confirm",
		title: "Run the last step?",
		summary: "The demo job has run two of its three steps.",
		affects: [],
		options: [
			{ id: "approve", label: "Run the last step" },
			{ id: "deny", label: "Stop the job" },
		],
	},
	commandIds: [],
	cancellable: true,
	survivesQuit: false,
	seq: 1,
};

const byName: Job = {
	...confirm,
	id: "job-2",
	title: "Destroy",
	request: {
		id: "req-2",
		kind: "confirm-by-name",
		title: "Destroy the deployment?",
		summary: "terraform destroy removes every resource.",
		affects: ["AWS account 1234-5678-9012"],
		expectedName: "support-triage",
		options: [
			{ id: "approve", label: "Destroy deployment", destructive: true },
			{ id: "deny", label: "Keep deployment" },
		],
	},
};

let requests: { name: string; input: unknown }[] = [];
let reply: () => Promise<unknown> = () => Promise.resolve({});

function stubTransport(): Transport {
	return {
		request: vi.fn((name: string, input: unknown) => {
			requests.push({ name, input });
			return reply();
		}) as Transport["request"],
		subscribe: () => () => {},
	};
}

/** Approval over the job in the store, re-read as a view reads it. */
function View({ jobId }: { jobId: string }) {
	const current = useJob(jobId);
	return current ? <Approval job={current} /> : null;
}

/** Puts `job` in the store and shows Approval over it. */
function show(job: Job) {
	requests = [];
	reply = () => Promise.resolve({});
	useJobStore.setState({ jobs: {} });
	setTransport(stubTransport());
	applyJobs([job]);
	render(<View jobId={job.id} />);
}

/** What the job does next: its request is answered (gone), as the job.updated event says. */
function answered(job: Job) {
	applyJobs([
		{ ...job, state: "running", request: undefined, seq: job.seq + 1 },
	]);
}

afterEach(() => {
	setTransport(undefined);
});

describe("approvalFrame and approvalOptions", () => {
	it("frames confirm as a card, confirm-by-name and a destructive approve as a modal", () => {
		const request = confirm.request;
		if (!request || !byName.request) throw new Error("fixture");
		expect(approvalFrame(request)).toBe("card");
		expect(approvalFrame(byName.request)).toBe("modal");
		expect(
			approvalFrame({
				...request,
				options: [{ id: "approve", label: "Delete", destructive: true }],
			}),
		).toBe("modal");
	});

	it("reads approve and deny from the options, with defaults when there are none", () => {
		const request = confirm.request;
		if (!request) throw new Error("fixture");
		expect(approvalOptions(request)).toEqual({
			approve: { id: "approve", label: "Run the last step" },
			deny: { id: "deny", label: "Stop the job" },
		});
		expect(approvalOptions({ ...request, options: undefined })).toEqual({
			approve: { id: "approve", label: "Approve" },
			deny: { id: "deny", label: "Deny" },
		});
	});
});

describe("Approval as a card", () => {
	it("answers approve through job.respond and shows the outcome in place once the request goes", async () => {
		show(confirm);
		const card = screen.getByRole("region", { name: "Run the last step?" });
		expect(within(card).queryByRole("button", { name: "Cancel" })).toBeNull();
		await userEvent.click(
			within(card).getByRole("button", { name: "Run the last step" }),
		);
		expect(requests).toEqual([
			{
				name: "job.respond",
				input: {
					jobId: "job-1",
					requestId: "req-1",
					answer: { optionId: "approve" },
				},
			},
		]);
		answered(confirm);
		await waitFor(() =>
			expect(screen.getByRole("status").textContent).toContain(
				"Approved by you",
			),
		);
	});

	it("shows a refused answer inline and lets the person answer again", async () => {
		show(confirm);
		reply = () =>
			Promise.reject(
				new StudioFailure({
					code: "job.notWaiting",
					message: "It ended or was answered elsewhere.",
				}),
			);
		await userEvent.click(screen.getByRole("button", { name: "Stop the job" }));
		await waitFor(() =>
			expect(screen.getByRole("alert").textContent).toContain(
				"The job is no longer waiting for an answer",
			),
		);
		expect(
			screen.getByRole("button", { name: "Run the last step" }),
		).toBeTruthy();
	});

	it("shows no outcome when the job stops while it waits", async () => {
		show(confirm);
		applyJobs([{ ...confirm, state: "cancelled", request: undefined, seq: 2 }]);
		await waitFor(() =>
			expect(
				screen.queryByRole("region", { name: "Run the last step?" }),
			).toBeNull(),
		);
		expect(screen.queryByRole("status")).toBeNull();
	});
});

describe("Approval as a modal (confirm-by-name)", () => {
	it("enables approve only on the exact name, and sends it", async () => {
		show(byName);
		const dialog = await screen.findByRole("alertdialog");
		const approve = within(dialog).getByRole("button", {
			name: "Destroy deployment",
		});
		expect(approve.hasAttribute("disabled")).toBe(true);
		const field = within(dialog).getByRole("textbox", {
			name: "Type support-triage to confirm",
		});
		await userEvent.type(field, "support-triag");
		expect(approve.hasAttribute("disabled")).toBe(true);
		await userEvent.type(field, "e");
		expect(approve.hasAttribute("disabled")).toBe(false);
		await userEvent.click(approve);
		expect(requests.map((r) => r.input)).toEqual([
			{
				jobId: "job-2",
				requestId: "req-2",
				answer: { optionId: "approve", name: "support-triage" },
			},
		]);
		answered(byName);
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
	});

	it("denies without the name, from its deny button", async () => {
		show(byName);
		const dialog = await screen.findByRole("alertdialog");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Keep deployment" }),
		);
		expect(requests.map((r) => r.input)).toEqual([
			{ jobId: "job-2", requestId: "req-2", answer: { optionId: "deny" } },
		]);
	});

	it("denies on Escape (the safe direction)", async () => {
		show(byName);
		await screen.findByRole("alertdialog");
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(requests.map((r) => r.input)).toEqual([
				{ jobId: "job-2", requestId: "req-2", answer: { optionId: "deny" } },
			]),
		);
	});
});
