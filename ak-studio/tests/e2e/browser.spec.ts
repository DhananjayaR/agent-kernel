// The renderer in a plain browser: no `window.studio`, so it runs on the mock transport.
import { expect, test } from "@playwright/test";

// The mock transport's fixture version (apps/renderer/src/bridge/mockTransport.ts, MOCK_VERSION). Not imported:
// the renderer's source is not loaded into the test runner.
const MOCK_VERSION = "0.0.0-mock";

test("renderer on the mock transport shows the version and platform", async ({
	page,
}) => {
	await page.goto("/");
	await expect(page.getByTestId("bridge")).toHaveText("mock");
	await expect(page.getByTestId("version")).toHaveText(MOCK_VERSION);
	await expect(page.getByTestId("platform")).toHaveText("browser");
	expect(await page.evaluate(() => "studio" in window)).toBe(false);
});

test("theme switch stores the preference and sets data-theme", async ({
	page,
}) => {
	await page.emulateMedia({ colorScheme: "light" });
	await page.goto("/");
	const html = page.locator("html");
	const select = page.getByTestId("theme");

	await expect(page.getByTestId("stored-theme")).toHaveText("system");
	await expect(html).toHaveAttribute("data-theme", "light");

	await select.selectOption("dark");
	await expect(page.getByTestId("stored-theme")).toHaveText("dark");
	await expect(html).toHaveAttribute("data-theme", "dark");

	await select.selectOption("light");
	await expect(page.getByTestId("stored-theme")).toHaveText("light");
	await expect(html).toHaveAttribute("data-theme", "light");

	// `system` follows prefers-color-scheme again.
	await select.selectOption("system");
	await page.emulateMedia({ colorScheme: "dark" });
	await expect(html).toHaveAttribute("data-theme", "dark");
});
