// JobProgress over a real job: the About demo job through the mock transport (its service behind a real registry),
// followed through the events subscription into the job store. The mock's FakeClock drives the job's steps and its
// `startedAt`, and ClockProvider gives the pattern the same clock, so the elapsed time is exact. Also the parts the
// demo job cannot reach (a failed job, commands, a job that cannot be stopped), from jobs put in the store.
import type { Job } from "@ak-studio/contract";
import { FakeClock } from "@ak-studio/runtime";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type ConnectedMock, connectMock } from "../../test/connectedMock";
import { defineCommand } from "../commands/command";
import { getCommands, setCommands } from "../commands/runCommand";
import { applyJobs, startJob } from "../jobs/jobStore";
import { ClockProvider } from "./clock";
import {
	JobProgress,
	JobProgressList,
	SHOW_COMMANDS_COMMAND,
} from "./JobProgress";

const SECOND = 1000;
const appCommands = getCommands();
let mock: ConnectedMock | undefined;
afterEach(() => {
	setCommands(appCommands);
	mock?.dispose();
	mock = undefined;
});

/** Starts the demo job and shows it with JobProgress, on the mock's clock. */
async function showDemo(
	props: { renderResult?: (job: Job) => ReactNode } = {},
) {
	const clock = new FakeClock(1_000_000);
	mock = connectMock({ clock });
	const Wrapper = mock.wrapper;
	const jobId = await startJob("about.demoJob", {});
	render(
		<Wrapper>
			<ClockProvider now={() => clock.now()}>
				<JobProgress jobId={jobId} {...props} />
			</ClockProvider>
		</Wrapper>,
	);
	const region = await screen.findByRole("region", { name: "Demo job" });
	const wait = (seconds: number) => act(() => clock.advance(seconds * SECOND));
	return { jobId, region, wait };
}

describe("JobProgress", () => {
	it("shows the step, the elapsed time from one second on, and Stop while the job runs", async () => {
		const { region, wait } = await showDemo();
		await waitFor(() =>
			expect(region.textContent).toContain("Step 1 of 3 · Checking the app"),
		);
		expect(region.textContent).not.toContain("Elapsed time");
		expect(within(region).getByRole("button", { name: "Stop" })).toBeTruthy();
		// No command behind the demo job: no "Show commands".
		expect(
			within(region).queryByRole("button", { name: "Show commands" }),
		).toBeNull();
		await wait(1);
		await waitFor(() =>
			expect(region.textContent).toContain("Step 2 of 3 · Preparing the demo"),
		);
		expect(region.textContent).toContain("Elapsed time 1 s");
	});

	it("asks the job's question as an approval card whose buttons say what happens; approving runs the last step", async () => {
		const { region, wait } = await showDemo({
			renderResult: (job) =>
				`Ran ${(job.result as { steps: number }).steps} steps.`,
		});
		await wait(2);
		const card = await within(region).findByRole("region", {
			name: "Run the last step?",
		});
		expect(region.textContent).toContain("Waiting for you");
		await userEvent.click(
			within(card).getByRole("button", { name: "Run the last step" }),
		);
		await waitFor(() =>
			expect(within(region).getByText("Approved by you")).toBeTruthy(),
		);
		await wait(1);
		await waitFor(() => expect(region.dataset.state).toBe("succeeded"));
		expect(region.textContent).toContain("Ran 3 steps.");
		expect(region.textContent).toContain("Approved by you");
		expect(within(region).queryByRole("button", { name: "Stop" })).toBeNull();
	});

	it("keeps the same card when the job's event beats the reply, so focus stays in the job", async () => {
		const { region, wait } = await showDemo();
		await wait(2);
		const card = await within(region).findByRole("region", {
			name: "Run the last step?",
		});
		within(card).getByRole("button", { name: "Run the last step" }).focus();
		await userEvent.keyboard("{Enter}");
		await waitFor(() =>
			expect(within(region).getByText("Approved by you")).toBeTruthy(),
		);
		expect(card.isConnected).toBe(true);
		expect(card.contains(document.activeElement)).toBe(true);
		expect(document.activeElement).toBe(card);
	});

	it("denying ends the job stopped, with the outcome in place", async () => {
		const { region, wait } = await showDemo();
		await wait(2);
		const card = await within(region).findByRole("region", {
			name: "Run the last step?",
		});
		await userEvent.click(
			within(card).getByRole("button", { name: "Stop the job" }),
		);
		await waitFor(() => expect(region.dataset.state).toBe("cancelled"));
		expect(region.textContent).toContain("Denied");
		expect(region.textContent).toContain("Stopped before it finished.");
	});

	it("Stop cancels the job; a job stopped while it waits shows no outcome", async () => {
		const { region, wait } = await showDemo();
		await wait(2);
		await within(region).findByRole("region", { name: "Run the last step?" });
		await userEvent.click(within(region).getByRole("button", { name: "Stop" }));
		await waitFor(() => expect(region.dataset.state).toBe("cancelled"));
		expect(region.textContent).not.toContain("Denied");
		expect(
			within(region).queryByRole("region", { name: "Run the last step?" }),
		).toBeNull();
	});
});

const base: Job = {
	id: "job-1",
	kind: "about.demoJob",
	title: "Detecting the toolchain",
	state: "running",
	commandIds: [],
	cancellable: true,
	survivesQuit: false,
	seq: 1,
};

/** Puts `jobs` in the store (no transport needed) and shows the first with JobProgress on a fixed clock. */
function showStored(...jobs: Job[]) {
	mock = connectMock();
	applyJobs(jobs);
	render(
		<ClockProvider now={() => 10_000}>
			<JobProgressList jobIds={jobs.map((job) => job.id)} />
		</ClockProvider>,
	);
}

describe("JobProgress, from jobs in the store", () => {
	it("shows a failed job's error by the catalogue's title, with its next action as an app command", async () => {
		const run = vi.fn();
		setCommands([
			defineCommand({ id: "about.checkAgain", title: "Check again", run }),
		]);
		showStored({
			...base,
			state: "failed",
			error: {
				code: "toolchain.missing",
				message: "uv is not on your PATH. Install it, then try again.",
				action: { label: "Check again", commandId: "about.checkAgain" },
			},
		});
		const alert = screen.getByRole("alert");
		// An unknown code is presented as the unexpected error; the message says what to do.
		expect(alert.textContent).toContain(
			"An unexpected error stopped this action",
		);
		expect(alert.textContent).toContain("uv is not on your PATH");
		await userEvent.click(
			within(alert).getByRole("button", { name: "Check again" }),
		);
		expect(run).toHaveBeenCalledOnce();
	});

	it("offers Show commands when the job ran commands and the shell's command exists", async () => {
		const run = vi.fn();
		setCommands([
			defineCommand({ id: SHOW_COMMANDS_COMMAND, title: "Show commands", run }),
		]);
		showStored({ ...base, commandIds: ["cmd-1"] });
		await userEvent.click(
			screen.getByRole("button", { name: "Show commands" }),
		);
		expect(run).toHaveBeenCalledOnce();
	});

	it("omits Show commands when the command is missing, and Stop when the job cannot be cancelled", () => {
		setCommands([]);
		showStored({ ...base, commandIds: ["cmd-1"], cancellable: false });
		expect(screen.queryByRole("button", { name: "Show commands" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
	});

	it("counts the elapsed time from the job's startedAt, and stacks several jobs newest first", () => {
		showStored(
			{ ...base, startedAt: 10_000 - 72_000 },
			{ ...base, id: "job-2", title: "Opening the project", startedAt: 9_500 },
		);
		const regions = screen.getAllByRole("region");
		expect(
			regions.map((region) => region.querySelector("h3")?.textContent),
		).toEqual(["Opening the project", "Detecting the toolchain"]);
		expect(regions[1]?.textContent).toContain("1 min 12 s");
		// Half a second: no time yet.
		expect(regions[0]?.textContent).not.toContain("Elapsed time");
	});

	it("says a refused stop inline", async () => {
		showStored(base);
		// The mock backend has no job-1: the cancel is refused.
		await userEvent.click(screen.getByRole("button", { name: "Stop" }));
		await waitFor(() =>
			expect(screen.getByRole("alert").textContent).toContain(
				"The job no longer exists",
			),
		);
	});
});
