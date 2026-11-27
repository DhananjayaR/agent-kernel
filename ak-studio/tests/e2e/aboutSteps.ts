// The About slice's end-to-end steps (P1b Task 18), shared by the browser spec (the mock transport) and the Electron
// spec (the real main process), so both prove the same thing: each shape through its pattern on the About screen.
// Not a spec itself (playwright.config.ts matches each project's spec by file name). The words are the app's copy
// (features/about/strings.ts, the runtime's about/strings.ts, the patterns' strings), not imported: the renderer's
// source is not loaded into the test runner.
import { expect, type Locator, type Page } from "@playwright/test";

/** A demo step takes about a second (the runtime's ABOUT_STEP_MS), so a step can take a few on a busy machine. */
export const STEP_TIMEOUT = 10_000;

/** The About screen's section `name` (each is a region named by its heading). */
export const section = (page: Page, name: string): Locator =>
	page.getByRole("region", { name, exact: true });

/** The newest demo job's card (several stack newest first). */
export const newestJob = (page: Page): Locator =>
	section(page, "Jobs")
		.getByRole("region", { name: "Demo job", exact: true })
		.first();

/** Opens the About screen from its tab, the last one. */
export async function openAbout(page: Page): Promise<void> {
	const tabs = page
		.getByRole("tablist", { name: "Project views" })
		.getByRole("tab");
	// "About", or "About" with a job notice's icon ("About Needs your answer").
	await expect(tabs.last()).toHaveText(/^About/);
	await tabs.last().click();
	await expect(
		page.getByRole("heading", { name: "About", level: 2 }),
	).toBeVisible();
}

/** The query: the version and platform main (or the mock) reports. */
export async function checkInfo(
	page: Page,
	version: string,
	platform: string,
): Promise<void> {
	const info = section(page, "This app");
	await expect(info.locator('[data-slot="about-version"]')).toHaveText(version);
	await expect(info.locator('[data-slot="about-platform"]')).toHaveText(
		platform,
	);
}

/** The note field, once its read has landed. */
async function noteField(page: Page): Promise<Locator> {
	const field = section(page, "Note").getByRole("textbox", { name: "Note" });
	await expect(field).toBeEnabled();
	return field;
}

/**
 * The command with a revision: a save, then the stale write. Edits while the note changes elsewhere show the
 * changed-on-disk banner; Keep mine writes mine over theirs, Take theirs drops mine for theirs.
 */
export async function checkNoteStaleWrite(page: Page): Promise<void> {
	const note = section(page, "Note");
	const field = await noteField(page);
	const save = note.getByRole("button", { name: "Save note" });
	await field.fill("First note");
	await save.click();
	await expect(save).toBeDisabled();

	// Mine, then the note changes elsewhere: the banner, the edits kept, Save held back.
	await field.fill("Mine");
	await note.getByRole("button", { name: "Change it elsewhere" }).click();
	const keep = note.getByRole("button", { name: "Keep mine" });
	await expect(keep).toBeVisible();
	await expect(
		note.getByText("File changed on disk while you were editing"),
	).toBeVisible();
	await expect(field).toHaveValue("Mine");
	await expect(save).toBeDisabled();
	await keep.click();
	await expect(keep).toBeHidden();
	await expect(field).toHaveValue("Mine");
	await expect(save).toBeDisabled();

	// Again, and take theirs.
	await field.fill("Mine again");
	await note.getByRole("button", { name: "Change it elsewhere" }).click();
	await note.getByRole("button", { name: "Take theirs" }).click();
	await expect(field).toHaveValue("Changed in another window.");
	await expect(keep).toBeHidden();
}

/** Starts a demo job from the screen and waits for its question; answers the card. */
async function runToQuestion(page: Page): Promise<Locator> {
	await section(page, "Jobs")
		.getByRole("button", { name: "Run the demo job" })
		.click();
	const job = newestJob(page);
	await expect(job).toHaveAttribute("data-state", /running|waiting/);
	const card = job.getByRole("region", { name: "Run the last step?" });
	await expect(card).toBeVisible({ timeout: STEP_TIMEOUT });
	return card;
}

/** The job answered with approve: its three steps' output, "Ran 3 steps.". */
export async function checkJobApproved(page: Page): Promise<void> {
	const card = await runToQuestion(page);
	await card.getByRole("button", { name: "Run the last step" }).click();
	const job = newestJob(page);
	await expect(job).toHaveAttribute("data-state", "succeeded", {
		timeout: STEP_TIMEOUT,
	});
	await expect(job).toContainText("Ran 3 steps.");
	await expect(
		section(page, "Jobs")
			.getByRole("region", { name: "Demo job output" })
			.getByText("Step 3 of 3: Finishing the demo"),
	).toBeVisible();
}

/** The job answered with deny: it ends stopped before the last step, "Denied" in place. */
export async function checkJobDenied(page: Page): Promise<void> {
	const card = await runToQuestion(page);
	await card.getByRole("button", { name: "Skip the last step" }).click();
	const job = newestJob(page);
	await expect(job).toHaveAttribute("data-state", "cancelled");
	await expect(
		job.getByRole("region", { name: "Denied: Run the last step?" }),
	).toBeVisible();
	await expect(
		section(page, "Jobs")
			.getByRole("region", { name: "Demo job output" })
			.getByText("Step 3 of 3: Finishing the demo"),
	).toHaveCount(0);
}

/** The job cancelled with Stop while it runs. */
export async function checkJobCancelled(page: Page): Promise<void> {
	await section(page, "Jobs")
		.getByRole("button", { name: "Run the demo job" })
		.click();
	const job = newestJob(page);
	await expect(job).toHaveAttribute("data-state", "running");
	await job.getByRole("button", { name: "Stop" }).click();
	await expect(job).toHaveAttribute("data-state", "cancelled");
	await expect(job).toContainText("Stopped before it finished.");
}

/** The session: the ticker started (its lines arrive) and stopped (they stop). */
export async function checkTicker(page: Page): Promise<void> {
	const ticker = section(page, "Ticker");
	const output = ticker.getByRole("region", { name: "Ticker output" });
	await ticker.getByRole("button", { name: "Start" }).click();
	await expect(ticker.getByRole("button", { name: "Stop" })).toBeVisible();
	await expect(output.getByText("Tick 2", { exact: true })).toBeVisible({
		timeout: STEP_TIMEOUT,
	});
	await ticker.getByRole("button", { name: "Stop" }).click();
	await expect(ticker.getByRole("button", { name: "Start" })).toBeVisible();
	// Stopped: no tick more than a second and a half later.
	const lines = await output.getByText(/^Tick \d+$/).count();
	await page.waitForTimeout(1500);
	expect(await output.getByText(/^Tick \d+$/).count()).toBe(lines);
}

/** Ctrl+K, "demo job", Enter: the palette runs about.runDemoJob, and the job shows on the About screen. */
export async function checkPaletteRunsDemoJob(page: Page): Promise<void> {
	await page.keyboard.press("Control+k");
	const palette = page.getByRole("dialog", { name: "Command palette" });
	await expect(palette).toBeVisible();
	await page.keyboard.type("demo job");
	await expect(palette.getByRole("option")).toHaveText([
		"About: Run the demo job",
	]);
	await page.keyboard.press("Enter");
	await expect(palette).toBeHidden();
	const job = newestJob(page);
	await expect(job).toHaveAttribute("data-state", /running|waiting/);
	await job.getByRole("button", { name: "Stop" }).click();
	await expect(job).toHaveAttribute("data-state", "cancelled");
}
