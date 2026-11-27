// The About screen on the mock backend (MockApp: the transport, the events feeding the stores, a router), with the
// mock's FakeClock driving the demo job's steps and the ticker: each section works through its pattern. The query
// shows the version and platform (and its failure in the error family); the note saves, shows the stale-write banner
// when it changed elsewhere (Keep mine, Take theirs), and asks before leaving with edits; the demo job is answered
// (approve, skip) or stopped, and its output shows; the ticker starts and stops; an interrupted demo job from an
// earlier run shows until dismissed.
import {
	ERROR_CODES,
	type InterruptedJob,
	StudioFailure,
} from "@ak-studio/contract";
import { FakeClock } from "@ak-studio/runtime";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { MockTransportOptions } from "../../../shared/bridge/mockTransport";
import { useStreamStore } from "../../../shared/streams/streamStore";
import { MockApp, type MockRouter } from "../../../test/MockApp";
import { AboutScreen } from "./AboutScreen";

const SECOND = 1000;

/** Every line the stream store holds, of every stream. */
const streamed = () =>
	Object.values(useStreamStore.getState().streams).flatMap((stream) =>
		(stream?.lines ?? []).map((line) => line.text),
	);

function renderAbout(options: MockTransportOptions = {}) {
	const clock = new FakeClock(1_000_000);
	let router: MockRouter | undefined;
	render(
		<MockApp
			options={{ clock, ...options }}
			onReady={(_backend, made) => {
				router = made;
			}}
		>
			<AboutScreen />
		</MockApp>,
	);
	const wait = (seconds: number) => act(() => clock.advance(seconds * SECOND));
	const section = (name: string) => screen.findByRole("region", { name });
	return {
		user: userEvent.setup(),
		wait,
		section,
		router: () => {
			if (!router) throw new Error("no router");
			return router;
		},
	};
}

describe("AboutScreen", () => {
	it("says what About is for and shows the app's version and platform", async () => {
		const { section } = renderAbout();
		expect(
			await screen.findByRole("heading", { level: 2, name: "About" }),
		).toBeTruthy();
		expect(
			screen.getByText(/demonstration of the Studio's building blocks/),
		).toBeTruthy();
		const info = await section("This app");
		await waitFor(() => expect(info.textContent).toContain("0.0.0-mock"));
		expect(info.textContent).toContain("browser");
	});

	it("shows a failed read in the error family", async () => {
		const { section } = renderAbout({
			handlers: {
				"about.info": () => {
					throw new StudioFailure({
						code: ERROR_CODES.internal,
						message: "Restart the app, then try again.",
					});
				},
			},
		});
		const info = await section("This app");
		await waitFor(() =>
			expect(info.textContent).toContain("Restart the app, then try again."),
		);
	});

	it("saves the note through its working copy", async () => {
		const { user, section } = renderAbout();
		const note = await section("Note");
		const field = within(note).getByRole("textbox", { name: "Note" });
		await waitFor(() => expect(field).toHaveProperty("disabled", false));
		const save = within(note).getByRole("button", { name: "Save note" });
		expect(save).toHaveProperty("disabled", true);
		await user.type(field, "hello");
		await user.click(save);
		await waitFor(() => expect(save).toHaveProperty("disabled", true));
		expect(field).toHaveProperty("value", "hello");
	});

	it("shows the stale-write banner when the note changed elsewhere; Keep mine writes mine, Take theirs drops it", async () => {
		const { user, section } = renderAbout();
		const note = await section("Note");
		const field = within(note).getByRole("textbox", { name: "Note" });
		await waitFor(() => expect(field).toHaveProperty("disabled", false));
		await user.type(field, "mine");
		await user.click(
			within(note).getByRole("button", { name: "Change it elsewhere" }),
		);
		const keep = await within(note).findByRole("button", { name: "Keep mine" });
		expect(field).toHaveProperty("value", "mine");
		expect(
			within(note).getByRole("button", { name: "Save note" }),
		).toHaveProperty("disabled", true);
		await user.click(keep);
		await waitFor(() =>
			expect(
				within(note).queryByRole("button", { name: "Keep mine" }),
			).toBeNull(),
		);
		expect(field).toHaveProperty("value", "mine");

		// Again, and this time take theirs.
		await user.type(field, " again");
		await user.click(
			within(note).getByRole("button", { name: "Change it elsewhere" }),
		);
		await user.click(
			await within(note).findByRole("button", { name: "Take theirs" }),
		);
		await waitFor(() =>
			expect(field).toHaveProperty("value", "Changed in another window."),
		);
		expect(
			within(note).queryByRole("button", { name: "Keep mine" }),
		).toBeNull();
	});

	it("asks before leaving with an unsaved note, naming it", async () => {
		const { user, section, router } = renderAbout();
		const note = await section("Note");
		const field = within(note).getByRole("textbox", { name: "Note" });
		await waitFor(() => expect(field).toHaveProperty("disabled", false));
		await user.type(field, "unsaved");
		// Not in act(): the navigation's promise waits for the dialog's answer.
		void router().navigate({ to: "/other" } as never);
		const dialog = await screen.findByRole("alertdialog", {
			name: "Unsaved changes in the About note",
		});
		await user.click(within(dialog).getByRole("button", { name: "Stay" }));
		expect(router().state.location.pathname).toBe("/");
		expect(field).toHaveProperty("value", "unsaved");
	});

	it("runs the demo job: its steps and output, the question answered with Run the last step", async () => {
		const { user, wait, section } = renderAbout();
		const demo = await section("Jobs");
		await user.click(
			within(demo).getByRole("button", { name: "Run the demo job" }),
		);
		const job = await within(demo).findByRole("region", { name: "Demo job" });
		await wait(2);
		const card = await within(job).findByRole("region", {
			name: "Run the last step?",
		});
		await user.click(
			within(card).getByRole("button", { name: "Run the last step" }),
		);
		await wait(1);
		await waitFor(() => expect(job.dataset.state).toBe("succeeded"));
		expect(job.textContent).toContain("Ran 3 steps.");
		// happy-dom has no layout, so the virtualised rows are not drawn (the stories and e2e see them): the list has
		// lines (Copy is enabled) and its stream holds the job's last.
		expect(
			within(demo).getByRole("region", { name: "Demo job output" }),
		).toBeTruthy();
		await waitFor(() =>
			expect(streamed()).toContain("Step 3 of 3: Finishing the demo"),
		);
		expect(within(demo).getByRole("button", { name: "Copy" })).toHaveProperty(
			"disabled",
			false,
		);
	});

	it("skips the last step when the question is answered with Skip the last step", async () => {
		const { user, wait, section } = renderAbout();
		const demo = await section("Jobs");
		await user.click(
			within(demo).getByRole("button", { name: "Run the demo job" }),
		);
		const job = await within(demo).findByRole("region", { name: "Demo job" });
		await wait(2);
		const card = await within(job).findByRole("region", {
			name: "Run the last step?",
		});
		await user.click(
			within(card).getByRole("button", { name: "Skip the last step" }),
		);
		await waitFor(() => expect(job.dataset.state).toBe("cancelled"));
		expect(within(card).getByRole("status").textContent).toBe("Denied");
	});

	it("stops the demo job with Stop", async () => {
		const { user, section } = renderAbout();
		const demo = await section("Jobs");
		await user.click(
			within(demo).getByRole("button", { name: "Run the demo job" }),
		);
		const job = await within(demo).findByRole("region", { name: "Demo job" });
		await user.click(await within(job).findByRole("button", { name: "Stop" }));
		await waitFor(() => expect(job.dataset.state).toBe("cancelled"));
		expect(job.textContent).toContain("Stopped before it finished.");
	});

	it("starts and stops the ticker, its lines in the list; the burst switch asks for 10,000 lines", async () => {
		const { user, wait, section } = renderAbout();
		const ticker = await section("Ticker");
		const burst = within(ticker).getByRole("switch", {
			name: "Write 10,000 lines at once after the first tick",
		});
		await user.click(burst);
		await user.click(within(ticker).getByRole("button", { name: "Start" }));
		const stop = await within(ticker).findByRole("button", { name: "Stop" });
		expect(burst).toHaveProperty("disabled", true);
		await wait(1);
		expect(
			within(ticker).getByRole("region", { name: "Ticker output" }),
		).toBeTruthy();
		await waitFor(() =>
			expect(streamed()).toContain("Burst line 10000 of 10000"),
		);
		expect(within(ticker).getByRole("button", { name: "Copy" })).toHaveProperty(
			"disabled",
			false,
		);
		await user.click(stop);
		await within(ticker).findByRole("button", { name: "Start" });
		expect(burst).toHaveProperty("disabled", false);
	});

	it("shows a demo job an earlier run left unfinished until it is dismissed", async () => {
		const record: InterruptedJob = {
			jobId: "job-earlier-1",
			kind: "about.demoJob",
			title: "Demo job",
			startedAt: 1_000,
			commandIds: [],
		};
		let records = [record];
		const dismissed = vi.fn(({ jobId }: { jobId: string }) => {
			records = records.filter((r) => r.jobId !== jobId);
			return {};
		});
		const { user } = renderAbout({
			handlers: {
				"jobs.interrupted": () => ({ records }),
				"jobs.dismissInterrupted": dismissed,
			},
		});
		const banner = await screen.findByText("Demo job was interrupted");
		const notice = banner.closest('[data-slot="inline-banner"]') as HTMLElement;
		await user.click(within(notice).getByRole("button", { name: "Dismiss" }));
		await waitFor(() =>
			expect(screen.queryByText("Demo job was interrupted")).toBeNull(),
		);
		expect(dismissed).toHaveBeenCalledExactlyOnceWith({
			jobId: "job-earlier-1",
		});
	});
});
