// VersionNotice's states (P1b gate step 4, design gate row (d); P2 row (c) for one control): a whole tab (the empty
// state frame with the version needed and the upgrade command to copy), the same without a command yet, a removed
// feature, a form section (the "Needs {since}" tag in the section list; opened, a banner over read-only fields), one
// control (it keeps its place with the tag; pressing it opens a popover with the version, the command and the docs
// link), a removed control, and the keyboard.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { expectFocusRing, expectSolidLayer, tabTo } from "../lib/story-checks";
import { Input } from "./input";
import { VersionNotice, VersionTag } from "./version-notice";

const COMMAND = 'uv add "agentkernel[openai,langgraph]>=0.12"';

const meta = {
	title: "Patterns/Version notice",
	component: VersionNotice,
	args: {
		size: "tab",
		feature: "Azure Functions deploy",
		status: "needs-upgrade",
		since: "0.12.0",
		version: "0.10.2",
		upgradeCommand: COMMAND,
		onCopyCommand: fn(),
		onOpenDocs: fn(),
	},
	render: (args) => (
		<div className="max-w-dialog-l">
			<VersionNotice {...args} />
		</div>
	),
} satisfies Meta<typeof VersionNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

const notice = (root: HTMLElement) =>
	root.querySelector("[data-slot=version-notice]") as HTMLElement;

/** A whole tab: the tab stays; its content says the version needed, the project's version and the command to copy. */
export const Tab: Story = {
	play: async ({ canvasElement, args }) => {
		const el = notice(canvasElement);
		await expect(
			within(el).getByRole("heading", {
				name: "Azure Functions deploy needs OAK 0.12.0 or later",
			}),
		).toBeVisible();
		await expect(el).toHaveTextContent(
			"This project uses OAK 0.10.2. Upgrade OAK in this project to use it.",
		);
		const code = within(el).getByText(COMMAND);
		await expect(code).toBeVisible();
		// Ligatures off: ">=" is drawn as typed, never as one glyph.
		await expect(getComputedStyle(code).fontVariantLigatures).toBe("none");
		await expect(el).toHaveTextContent("The Studio does not run it for you.");
		await userEvent.click(
			within(el).getByRole("button", { name: "Copy code" }),
		);
		await expect(args.onCopyCommand).toHaveBeenCalledWith(COMMAND);
		await userEvent.click(
			within(el).getByRole("button", { name: "Open the docs" }),
		);
		await expect(args.onOpenDocs).toHaveBeenCalledOnce();
	},
};

/** No command known yet (P2 builds it) and no docs opener: the words still say what is needed and what to do. */
export const TabWithoutCommand: Story = {
	args: { upgradeCommand: undefined, onOpenDocs: undefined },
	play: async ({ canvasElement }) => {
		const el = notice(canvasElement);
		await expect(el).toHaveTextContent(
			"Upgrade OAK in this project to use it.",
		);
		await expect(el.querySelector("[data-slot=code-block]")).toBeNull();
		await expect(within(el).queryByRole("button")).toBeNull();
	},
};

/** Removed: the version that dropped it and what replaces it; no upgrade command. */
export const TabRemoved: Story = {
	args: {
		feature: "Legacy session store",
		status: "removed",
		since: undefined,
		until: "0.14.0",
		replacedBy: "Redis session store",
		version: "0.14.1",
	} as Story["args"],
	play: async ({ canvasElement }) => {
		const el = notice(canvasElement);
		await expect(
			within(el).getByRole("heading", {
				name: "Legacy session store was removed in OAK 0.14.0",
			}),
		).toBeVisible();
		await expect(el).toHaveTextContent("Use Redis session store instead.");
		await expect(el.querySelector("[data-slot=code-block]")).toBeNull();
	},
};

/** A form section, opened: the banner with the version and the command over its fields, which are read-only. */
export const Section: Story = {
	args: { size: "section" },
	render: (args) => (
		<div className="flex max-w-dialog-l flex-col gap-4">
			<VersionNotice {...args} />
			<Input label="Function app name" value="support-triage" isReadOnly />
			<Input label="Region" value="westeurope" isReadOnly />
		</div>
	),
	play: async ({ canvasElement }) => {
		const el = notice(canvasElement);
		await expect(el).toHaveAttribute("data-tone", "info");
		await expect(el).toHaveTextContent(
			"Azure Functions deploy needs OAK 0.12.0 or later",
		);
		await expect(el).toHaveTextContent(
			"The fields below are read-only until then.",
		);
		const field = within(canvasElement).getByRole("textbox", {
			name: "Function app name",
		});
		await expect(field).toHaveAttribute("readonly");
	},
};

/** A removed section with nothing named to replace it: what to do instead, and its fields read-only. */
export const SectionRemoved: Story = {
	args: {
		size: "section",
		feature: "Legacy session store",
		status: "removed",
		since: undefined,
		until: "0.14.0",
		version: "0.14.1",
	} as Story["args"],
	play: async ({ canvasElement }) => {
		const el = notice(canvasElement);
		await expect(el).toHaveTextContent(
			"Legacy session store was removed in OAK 0.14.0",
		);
		await expect(el).toHaveTextContent(
			"Check the OAK release notes for what replaces it.",
		);
		await expect(el).toHaveTextContent("The fields below are read-only.");
		await expect(el.querySelector("[data-slot=code-block]")).toBeNull();
	},
};

/** The section list: a gated section stays, with the "Needs {since}" tag in text (not dimmed). */
export const SectionTag: Story = {
	render: () => (
		<ul className="flex max-w-dialog-m flex-col gap-1 text-ui text-text">
			<li className="flex h-row items-center justify-between px-edge">
				Session store
			</li>
			<li className="flex h-row items-center justify-between px-edge">
				Azure Functions deploy
				<VersionTag status="needs-upgrade" since="0.12.0" />
			</li>
			<li className="flex h-row items-center justify-between px-edge">
				Legacy session store
				<VersionTag status="removed" until="0.14.0" />
			</li>
		</ul>
	),
	play: async ({ canvasElement }) => {
		const tags = canvasElement.querySelectorAll("[data-slot=version-tag]");
		await expect([...tags].map((tag) => tag.textContent)).toEqual([
			"Needs 0.12.0",
			"Removed in 0.14.0",
		]);
	},
};

/** One control (P2's palette tile): it keeps its place with the tag; pressing it opens the popover. */
export const Control: Story = {
	args: { size: "control", label: "Azure Functions" },
	render: (args) => (
		<div className="flex h-96 items-start gap-2">
			<VersionNotice {...args} />
		</div>
	),
	play: async ({ canvasElement, args }) => {
		const control = within(canvasElement).getByRole("button", {
			name: /Azure Functions/,
		});
		await expect(control).toHaveTextContent("Needs 0.12.0");
		await userEvent.click(control);
		const popover = await within(document.body).findByRole("dialog", {
			name: "Azure Functions deploy needs OAK 0.12.0 or later",
		});
		await expectSolidLayer(
			popover.closest("[data-slot=popover]") as HTMLElement,
		);
		await expect(popover).toHaveTextContent("This project uses OAK 0.10.2.");
		await expect(within(popover).getByText(COMMAND)).toBeVisible();
		await userEvent.click(
			within(popover).getByRole("button", { name: "Open the docs" }),
		);
		await expect(args.onOpenDocs).toHaveBeenCalledOnce();
	},
};

/** A removed control: "Removed in {until}", and the popover names its replacement. */
export const ControlRemoved: Story = {
	args: {
		size: "control",
		label: "Legacy store",
		feature: "Legacy session store",
		status: "removed",
		since: undefined,
		until: "0.14.0",
		replacedBy: "Redis session store",
	} as Story["args"],
	render: (args) => (
		<div className="flex h-96 items-start gap-2">
			<VersionNotice {...args} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const control = within(canvasElement).getByRole("button", {
			name: /Legacy store/,
		});
		await expect(control).toHaveTextContent("Removed in 0.14.0");
		await userEvent.click(control);
		const popover = await within(document.body).findByRole("dialog");
		await expect(popover).toHaveTextContent("Use Redis session store instead.");
	},
};

/** The keyboard: Tab to the control, Enter opens the popover with focus in it, Escape closes it and focus returns. */
export const Keyboard: Story = {
	args: { size: "control", label: "Azure Functions" },
	render: (args) => (
		<div className="flex h-96 items-start gap-2">
			<VersionNotice {...args} />
		</div>
	),
	play: async ({ canvasElement, args }) => {
		const control = within(canvasElement).getByRole("button", {
			name: /Azure Functions/,
		});
		await tabTo(control);
		await expectFocusRing(control);
		await userEvent.keyboard("{Enter}");
		const popover = await within(document.body).findByRole("dialog");
		await waitFor(() =>
			expect(popover.contains(document.activeElement)).toBe(true),
		);
		const copy = within(popover).getByRole("button", { name: "Copy code" });
		await tabTo(copy);
		await userEvent.keyboard("{Enter}");
		await expect(args.onCopyCommand).toHaveBeenCalledWith(COMMAND);
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(within(document.body).queryByRole("dialog")).toBeNull(),
		);
		await waitFor(() => expect(control).toHaveFocus());
		// For the screenshot: open again from the keyboard.
		await userEvent.keyboard("{Enter}");
		await within(document.body).findByRole("dialog");
	},
};
