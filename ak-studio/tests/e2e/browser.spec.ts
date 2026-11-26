// The renderer in a plain browser: no `window.studio`, so it runs on the mock transport.
import { expect, type Page, test } from "@playwright/test";

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
	).toHaveText(TABS.map(([name]) => name));
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
