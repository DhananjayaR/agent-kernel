// The renderer in a plain browser: no `window.studio`, so it runs on the mock transport.
import { expect, type Page, test } from "@playwright/test";
import {
	checkInfo,
	checkJobApproved,
	checkJobCancelled,
	checkJobDenied,
	checkNoteStaleWrite,
	checkPaletteRunsDemoJob,
	checkTicker,
	newestJob,
	openAbout,
	STEP_TIMEOUT,
	section,
} from "./aboutSteps";

// The mock transport's fixture version (apps/renderer/src/shared/bridge/mockTransport.ts, MOCK_VERSION). Not imported:
// the renderer's source is not loaded into the test runner.
const MOCK_VERSION = "0.0.0-mock";

const TABS = [
	["Canvas", "canvas", /P3/],
	["Code", "code", /P3/],
	["Config", "config", /P3/],
	["Test & trace", "test-trace", /P8.*P9/],
	["Deploy", "deploy", /P10/],
] as const;

/** About's temporary tab, after the product tabs; it goes with the About feature when P2 lands. */
const ABOUT_TAB = "About";

const appVersion = (page: Page) =>
	page.locator('[data-slot="app-version-number"]');

test("the shell renders on the mock transport", async ({ page }) => {
	await page.goto("/");
	await expect(page).toHaveURL(/#\/canvas$/);
	await expect(appVersion(page)).toHaveText(MOCK_VERSION);
	expect(await page.evaluate(() => "studio" in window)).toBe(false);
	await expect(page.getByRole("banner")).toBeVisible();
	// No project can be opened yet: every project-scoped part shows its not-yet state.
	await expect(page.getByText("No project open")).toBeVisible();
	const run = page.getByRole("group", { name: "Local run" });
	await expect(run).toHaveText("No project to run");
	await expect(run.getByRole("button")).toHaveCount(0);
	await expect(page.locator('[data-slot="deploy-status"]')).toHaveText(
		"Deployment: Not deployed",
	);
	await expect(page.getByRole("contentinfo")).toContainText(
		"Claude Agent not set up",
	);
	await expect(
		page.getByRole("tablist", { name: "Project views" }).getByRole("tab"),
	).toHaveText([...TABS.map(([name]) => name), ABOUT_TAB]);
	await expect(
		page.getByRole("button", { name: "Build with AI" }),
	).toBeVisible();
	await expect(page.getByRole("region", { name: "Panel" })).toBeVisible();
	await expect(page.getByRole("contentinfo")).toBeVisible();
});

test("each tab opens its empty state, naming the phase that fills it", async ({
	page,
}) => {
	await page.goto("/");
	for (const [name, path, phase] of TABS) {
		await page.getByRole("tab", { name }).click();
		await expect(page).toHaveURL(new RegExp(`#/${path}$`));
		const panel = page.getByRole("tabpanel", { name });
		await expect(panel.getByRole("heading", { name, level: 2 })).toBeVisible();
		await expect(panel).toContainText(phase);
	}
	// A tab's address opens it directly; an unknown one opens the canvas.
	await page.goto("/#/deploy");
	await expect(page.getByRole("tab", { name: "Deploy" })).toHaveAttribute(
		"aria-selected",
		"true",
	);
	await page.goto("/#/nowhere");
	await expect(page).toHaveURL(/#\/canvas$/);
});

test("the theme switches from the settings modal and sets data-theme", async ({
	page,
}) => {
	await page.emulateMedia({ colorScheme: "light" });
	await page.goto("/");
	const html = page.locator("html");
	await expect(html).toHaveAttribute("data-theme", "light");

	await page.getByRole("button", { name: "Settings" }).click();
	const dialog = page.getByRole("dialog", { name: "Settings" });
	const radio = (name: string) => dialog.getByRole("radio", { name });
	await expect(radio("System")).toBeChecked();

	await radio("Dark").click();
	await expect(radio("Dark")).toBeChecked();
	await expect(html).toHaveAttribute("data-theme", "dark");

	await radio("Light").click();
	await expect(html).toHaveAttribute("data-theme", "light");

	// `system` follows prefers-color-scheme again.
	await radio("System").click();
	await page.emulateMedia({ colorScheme: "dark" });
	await expect(html).toHaveAttribute("data-theme", "dark");

	await page.keyboard.press("Escape");
	await expect(dialog).toBeHidden();
	await expect(page.getByRole("button", { name: "Settings" })).toBeFocused();
});

test("the bottom panel hides and shows with Ctrl+J and its toggle, keeping focus", async ({
	page,
}) => {
	await page.goto("/");
	const panel = page.locator('[data-panel][id="bottom-panel"]');
	await expect(panel).toHaveJSProperty("offsetHeight", 240);
	await page.getByRole("tab", { name: "Commands" }).focus();
	await page.keyboard.press("Control+j");
	const show = page.getByRole("button", { name: "Show the panel" });
	await expect(show).toBeVisible();
	await expect(panel).toHaveJSProperty("offsetHeight", 48);
	await show.click();
	await expect(panel).toHaveJSProperty("offsetHeight", 240);
	await expect(
		page.getByRole("button", { name: "Hide the panel" }),
	).toBeFocused();
});

test("Ctrl+J does nothing while a modal is open, and acts again once it closes", async ({
	page,
}) => {
	await page.goto("/");
	const panel = page.locator('[data-panel][id="bottom-panel"]');
	await expect(panel).toHaveJSProperty("offsetHeight", 240);
	await page.getByRole("button", { name: "Settings" }).click();
	const dialog = page.getByRole("dialog", { name: "Settings" });
	await expect(dialog).toBeVisible();
	await page.keyboard.press("Control+j");
	await expect(dialog).toBeVisible();
	await expect(panel).toHaveJSProperty("offsetHeight", 240);
	await page.keyboard.press("Escape");
	await expect(dialog).toBeHidden();
	await page.keyboard.press("Control+j");
	await expect(panel).toHaveJSProperty("offsetHeight", 48);
	await expect(
		page.getByRole("button", { name: "Show the panel" }),
	).toHaveAttribute("aria-keyshortcuts", "Control+J");
});

test("holds at 1100 px: one row in the top bar (compact, with the window controls), no horizontal scroll", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1100, height: 720 });
	await page.goto("/");
	await expect(appVersion(page)).toHaveText(MOCK_VERSION);
	const layout = await page.evaluate(() => {
		const bar = document.querySelector('[data-slot="top-bar"]') as HTMLElement;
		return {
			innerWidth: window.innerWidth,
			scrollWidth: document.documentElement.scrollWidth,
			barHeight: bar.getBoundingClientRect().height,
			barScroll: bar.scrollWidth - bar.clientWidth,
			compact: bar.hasAttribute("data-compact"),
		};
	});
	expect(layout).toEqual({
		innerWidth: 1100,
		scrollWidth: 1100,
		barHeight: 48,
		barScroll: 0,
		compact: true,
	});
});

test("shows the window controls in the browser, and Maximise toggles to Restore", async ({
	page,
}) => {
	await page.goto("/");
	await expect(appVersion(page)).toHaveText(MOCK_VERSION);
	const controls = page.getByRole("group", { name: "Window controls" });
	await controls.getByRole("button", { name: "Maximise" }).click();
	await expect(controls.getByRole("button", { name: "Restore" })).toBeVisible();
	await controls.getByRole("button", { name: "Restore" }).click();
	await expect(
		controls.getByRole("button", { name: "Maximise" }),
	).toBeVisible();
});

test("Ctrl+K opens the command palette: typing filters, Enter runs about.runDemoJob, and the job appears", async ({
	page,
}) => {
	await page.goto("/");
	await expect(appVersion(page)).toHaveText(MOCK_VERSION);
	const panel = page.locator('[data-panel][id="bottom-panel"]');
	await expect(panel).toHaveJSProperty("offsetHeight", 240);
	const before = page.getByRole("tab", { name: "Canvas" });
	await before.focus();
	await page.keyboard.press("Control+k");
	const palette = page.getByRole("dialog", { name: "Command palette" });
	await expect(palette).toBeVisible();
	const search = palette.getByRole("combobox", { name: "Search commands" });
	await expect(search).toBeFocused();
	// Every command, with its feature's title and its shortcut; Ctrl+J does nothing while it is open.
	await expect(
		palette.getByRole("option", { name: "View: Show or hide the panel" }),
	).toContainText("Ctrl+J");
	await page.keyboard.press("Control+j");
	// Two frames for a toggle to land, then: the panel unchanged, the palette still open with focus in it.
	await page.evaluate(
		() =>
			new Promise((done) =>
				requestAnimationFrame(() => requestAnimationFrame(done)),
			),
	);
	await expect(panel).toHaveJSProperty("offsetHeight", 240);
	await expect(palette).toBeVisible();
	await expect(search).toBeFocused();
	await page.keyboard.type("demo job");
	await expect(palette.getByRole("option")).toHaveText([
		"About: Run the demo job",
	]);
	// The match is marked: Enter acts on the row shown.
	await expect(palette.getByRole("option")).toHaveAttribute(
		"aria-selected",
		"true",
	);
	await page.keyboard.press("Enter");
	await expect(palette).toBeHidden();
	await expect(before).toBeFocused();
	// The job runs in the background (About is not on screen): its notice says it is waiting for an answer.
	await expect(
		page.getByText("Demo job is waiting for you", { exact: true }),
	).toBeVisible({ timeout: 10_000 });
});

test("Ctrl+J still acts while a popover (not a modal) is open", async ({
	page,
}) => {
	await page.goto("/");
	const panel = page.locator('[data-panel][id="bottom-panel"]');
	await expect(panel).toHaveJSProperty("offsetHeight", 240);
	await page.getByRole("button", { name: "Build with AI" }).click();
	await expect(
		page.getByRole("dialog", { name: "Build with AI" }),
	).toBeVisible();
	await page.keyboard.press("Control+j");
	await expect(panel).toHaveJSProperty("offsetHeight", 48);
});

// The About slice on the mock transport (P1b Task 18): every shape through its pattern (aboutSteps.ts).
test.describe("the About screen", () => {
	test("shows the query's version and platform", async ({ page }) => {
		await page.goto("/");
		await openAbout(page);
		await expect(page).toHaveURL(/#\/about$/);
		await checkInfo(page, MOCK_VERSION, "browser");
	});

	test("saves the note; a stale write shows the banner, and Keep mine and Take theirs resolve it", async ({
		page,
	}) => {
		await page.goto("/");
		await openAbout(page);
		await checkNoteStaleWrite(page);
	});

	test("runs the demo job: answered with approve, answered with deny, and cancelled", async ({
		page,
	}) => {
		await page.goto("/");
		await openAbout(page);
		await checkJobApproved(page);
		await checkJobDenied(page);
		await checkJobCancelled(page);
	});

	test("starts and stops the ticker", async ({ page }) => {
		await page.goto("/");
		await openAbout(page);
		await checkTicker(page);
	});

	test("Ctrl+K runs about.runDemoJob, and the job shows on the About screen", async ({
		page,
	}) => {
		await page.goto("/");
		await openAbout(page);
		await checkPaletteRunsDemoJob(page);
	});

	// A reload cannot reattach here: the mock's services live in the page, so a reload starts a fresh backend (the
	// Electron spec proves reattach against the real main process). What the browser proves: leaving About mid-job
	// and coming back shows the same job, its output so far and its question, still answerable.
	test("leaving mid-job and coming back shows the job, its output and its question again", async ({
		page,
	}) => {
		await page.goto("/");
		await openAbout(page);
		await section(page, "Jobs")
			.getByRole("button", { name: "Run the demo job" })
			.click();
		await expect(newestJob(page)).toHaveAttribute("data-state", "running");
		await page.getByRole("tab", { name: "Canvas" }).click();
		await expect(
			page.getByText("Demo job is waiting for you", { exact: true }),
		).toBeVisible({ timeout: STEP_TIMEOUT });
		// A waiting job is never only a toast: About's tab carries the icon.
		await expect(
			page.getByRole("tab", { name: "About Needs your answer" }),
		).toBeVisible();
		await openAbout(page);
		const job = newestJob(page);
		await expect(job).toHaveAttribute("data-state", "waiting");
		await expect(
			section(page, "Jobs")
				.getByRole("region", { name: "Demo job output" })
				.getByText("Step 2 of 3: Preparing the demo"),
		).toBeVisible();
		await job
			.getByRole("region", { name: "Run the last step?" })
			.getByRole("button", { name: "Run the last step" })
			.click();
		await expect(job).toHaveAttribute("data-state", "succeeded", {
			timeout: STEP_TIMEOUT,
		});
	});
});
