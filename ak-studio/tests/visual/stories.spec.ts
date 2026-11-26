// One screenshot per story and theme, compared with its committed baseline (playwright.visual.config.ts). The
// stories come from the built Storybook's index.json, so a new story gets a test (and needs a baseline) without
// an edit here. Each story is opened alone (iframe.html), at its own viewport when it names one (the shell
// stories), and photographed only once Storybook has finished it: rendered, its play function run and its
// afterEach checks passed. The bundled fonts must have loaded first.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";

const STORYBOOK = join(__dirname, "../../packages/ui/storybook-static");
/** Fewer stories than this means the index was not read properly (P1b has 200). */
const MIN_STORIES = 150;
const THEMES = ["dark", "light"] as const;

interface IndexEntry {
	type: "story" | "docs";
	id: string;
}

function storyIds(): string[] {
	let index: { entries: Record<string, IndexEntry> };
	try {
		index = JSON.parse(readFileSync(join(STORYBOOK, "index.json"), "utf8"));
	} catch (error) {
		throw new Error(
			`no built Storybook at packages/ui/storybook-static (run pnpm build-storybook): ${String(error)}`,
		);
	}
	return Object.values(index.entries)
		.filter((entry) => entry.type === "story")
		.map((entry) => entry.id)
		.sort();
}

const ids = storyIds();

test("the built Storybook lists the stories", () => {
	expect(ids.length).toBeGreaterThanOrEqual(MIN_STORIES);
});

test("every baseline belongs to a story and theme (none left by a deleted or renamed story)", () => {
	const expected = new Set(
		ids.flatMap((id) => THEMES.map((theme) => `${id}-${theme}.png`)),
	);
	const baselines = join(__dirname, "__screenshots__", "linux");
	const orphans = readdirSync(baselines).filter((name) => !expected.has(name));
	expect(orphans).toEqual([]);
});

/** Waits until Storybook has finished the story (after play and afterEach); fails on a story that errored. */
async function storyFinished(page: Page): Promise<void> {
	const phase = await page.waitForFunction(
		() => {
			type Preview = { currentRender?: { phase?: string } };
			const preview = (window as { __STORYBOOK_PREVIEW__?: Preview })
				.__STORYBOOK_PREVIEW__;
			const current = preview?.currentRender?.phase;
			return current === "finished" ||
				current === "errored" ||
				current === "aborted"
				? current
				: false;
		},
		undefined,
		{ timeout: 30_000 },
	);
	expect(await phase.jsonValue(), "the story's render phase").toBe("finished");
	await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** The viewport the story asks for (the shell stories' `atViewport`), if any. */
async function storyViewport(
	page: Page,
): Promise<{ width: number; height: number } | undefined> {
	return page.evaluate(() => {
		type Story = {
			storyGlobals?: { viewport?: { value?: string } };
			parameters?: {
				viewport?: {
					options?: Record<
						string,
						{ styles?: { width?: string; height?: string } }
					>;
				};
			};
		};
		const preview = (
			window as {
				__STORYBOOK_PREVIEW__?: { currentRender?: { story?: Story } };
			}
		).__STORYBOOK_PREVIEW__;
		const story = preview?.currentRender?.story;
		const name = story?.storyGlobals?.viewport?.value;
		const styles = name
			? story?.parameters?.viewport?.options?.[name]?.styles
			: undefined;
		if (!styles?.width || !styles.height) return undefined;
		return {
			width: Number.parseInt(styles.width, 10),
			height: Number.parseInt(styles.height, 10),
		};
	});
}

for (const id of ids) {
	for (const theme of THEMES) {
		test(`${id} (${theme})`, async ({ page }) => {
			const url = `/iframe.html?id=${encodeURIComponent(id)}&viewMode=story&globals=theme:${theme}`;
			await page.goto(url);
			await storyFinished(page);
			const viewport = await storyViewport(page);
			if (viewport) {
				// Render again at the story's own size, so its layout and play function see that width.
				await page.setViewportSize(viewport);
				await page.goto(url);
				await storyFinished(page);
			}
			await expect(page).toHaveScreenshot(`${id}-${theme}.png`);
		});
	}
}
