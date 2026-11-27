// Storybook stories for the About screen (indexed from the renderer, P1b-plan ruling 16), one per state, each on the
// mock backend (MockApp) with its own FakeClock (from a loader, so every render starts at the same time): the job's
// steps and the ticker run only when a play function moves time on, and the elapsed time never moves, so the
// screenshots are stable. Type-free CSF, as the renderer does not depend on Storybook: play functions use the
// context's `canvas` and `userEvent`.
import { ERROR_CODES, StudioFailure } from "@ak-studio/contract";
import {
	FakeClock,
	type MockTransportOptions,
} from "../../../shared/bridge/mockTransport";
import { MockApp } from "../../../test/MockApp";
import { AboutScreen } from "./AboutScreen";

/** 27 November 2026, 09:00 UTC: every story's clock starts here. */
const START = Date.UTC(2026, 10, 27, 9, 0, 0);

type Loaded = { loaded: { clock: FakeClock } };

/** What a play function uses from Storybook's context (typed here: the renderer does not depend on Storybook). */
type Play = Loaded & {
	canvas: {
		findByRole(role: string, options: { name: string }): Promise<HTMLElement>;
		findByText(text: string): Promise<HTMLElement>;
	};
	userEvent: {
		click(element: HTMLElement): Promise<void>;
		type(element: HTMLElement, text: string): Promise<void>;
	};
};

/** A story of the screen on the mock, with the loader's clock and these mock options. */
function story(options: Omit<MockTransportOptions, "clock"> = {}) {
	return {
		loaders: [async () => ({ clock: new FakeClock(START) })],
		render: (_args: unknown, { loaded }: Loaded) => (
			<MockApp options={{ ...options, clock: loaded.clock }}>
				<AboutScreen />
			</MockApp>
		),
	};
}

/** Scrolls the section `name` into view, so the screenshot shows it. */
async function showSection(canvas: Play["canvas"], name: string) {
	(await canvas.findByRole("region", { name })).scrollIntoView({
		block: "center",
	});
}

export default {
	title: "Screens/About",
	component: AboutScreen,
};

/** Read: the version and platform, an empty note, no demo job yet, the ticker stopped. */
export const Default = {
	...story(),
	play: async ({ canvas }: Play) => {
		await canvas.findByText("0.0.0-mock");
	},
};

/** The app's details could not be read: the error family in the section. */
export const InfoFailed = {
	...story({
		handlers: {
			"about.info": () => {
				throw new StudioFailure({
					code: ERROR_CODES.internal,
					message: "Restart the app, then try again.",
				});
			},
		},
	}),
	play: async ({ canvas }: Play) => {
		await canvas.findByText("Restart the app, then try again.");
	},
};

/** The note changed elsewhere while it had edits: the stale-write banner, with Keep mine and Take theirs. */
export const NoteConflict = {
	...story(),
	play: async ({ canvas, userEvent }: Play) => {
		const field = await canvas.findByRole("textbox", { name: "Note" });
		await waitUntil(() => !(field as HTMLTextAreaElement).disabled);
		await userEvent.type(field, "My edits, not saved yet");
		await userEvent.click(
			await canvas.findByRole("button", { name: "Change it elsewhere" }),
		);
		await canvas.findByRole("button", { name: "Keep mine" });
		await showSection(canvas, "Note");
	},
};

/** The demo job at its question, after two steps: the inline approval and the output so far. */
export const JobWaiting = {
	...story(),
	play: async ({ canvas, userEvent, loaded }: Play) => {
		await userEvent.click(
			await canvas.findByRole("button", { name: "Run the demo job" }),
		);
		await canvas.findByRole("button", { name: "Stop" });
		await loaded.clock.advance(2000);
		await canvas.findByRole("region", { name: "Run the last step?" });
		await showSection(canvas, "Demo job output");
	},
};

/** The ticker running for three seconds: the control says so, and the list shows its lines. */
export const TickerRunning = {
	...story(),
	play: async ({ canvas, userEvent, loaded }: Play) => {
		await userEvent.click(await canvas.findByRole("button", { name: "Start" }));
		await canvas.findByRole("button", { name: "Stop" });
		await loaded.clock.advance(3000);
		await canvas.findByText("Tick 3");
		await showSection(canvas, "Ticker output");
	},
};

/** A demo job an earlier run left unfinished (the app was killed): the notice at the top, with Dismiss. */
export const Interrupted = {
	...story({
		handlers: {
			"jobs.interrupted": () => ({
				records: [
					{
						jobId: "job-earlier-1",
						kind: "about.demoJob",
						title: "Demo job",
						startedAt: START - 60_000,
						commandIds: [],
					},
				],
			}),
		},
	}),
	play: async ({ canvas }: Play) => {
		await canvas.findByText("Demo job was interrupted");
	},
};

/** Polls `ready` each frame until it holds (a field enabled once its read lands). */
async function waitUntil(ready: () => boolean): Promise<void> {
	for (let i = 0; i < 300 && !ready(); i++)
		await new Promise((resolve) => requestAnimationFrame(resolve));
	if (!ready()) throw new Error("not ready after 300 frames");
}
