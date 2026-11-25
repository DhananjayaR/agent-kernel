import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	expect,
	fireEvent,
	fn,
	userEvent,
	waitFor,
	within,
} from "storybook/test";
import { expectTokenColour, tabTo } from "../lib/story-checks";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanels,
} from "./resizable-panels";

const meta = {
	title: "Structure/Resizable panels",
	component: ResizablePanels,
	args: {
		id: "builder",
		onLayoutChange: fn(),
		children: null,
	},
	render: (args) => (
		<div className="h-80 w-full max-w-3xl border border-border-default">
			<ResizablePanels {...args}>
				<ResizablePanel id="canvas" defaultSize="70%" minSize="30%">
					<div className="p-4">Canvas</div>
				</ResizablePanel>
				<ResizableHandle aria-label="Resize the inspector" />
				<ResizablePanel id="inspector" defaultSize="30%" minSize="20%">
					<div className="p-4">Inspector</div>
				</ResizablePanel>
			</ResizablePanels>
		</div>
	),
} satisfies Meta<typeof ResizablePanels>;

export default meta;
type Story = StoryObj<typeof meta>;

const handle = (canvasElement: HTMLElement) =>
	within(canvasElement).getByRole("separator", {
		name: "Resize the inspector",
	});
const panel = (canvasElement: HTMLElement, id: string) =>
	canvasElement.querySelector(`[data-panel][id="${id}"]`) as HTMLElement;

/** Side by side, 70/30 by default, with a 1 px decorative rule between. */
export const Default: Story = {
	play: async ({ canvasElement }) => {
		const el = handle(canvasElement);
		await expect(el.getBoundingClientRect().width).toBe(1);
		await expectTokenColour(el, "background-color", "bg-border-default");
		const group = el.parentElement as HTMLElement;
		const share =
			panel(canvasElement, "inspector").getBoundingClientRect().width /
			group.getBoundingClientRect().width;
		await expect(Math.round(share * 100)).toBe(30);
	},
};

/** Hover (the pointer over the handle's hit area) draws a 2 px line in the control colour. */
export const Hover: Story = {
	play: async ({ canvasElement }) => {
		const el = handle(canvasElement);
		const box = el.getBoundingClientRect();
		// The library tracks the pointer on the document by position (its hit area is wider than the rule).
		fireEvent.pointerMove(el, {
			clientX: box.left + 2,
			clientY: box.top + box.height / 2,
		});
		await waitFor(() => expect(el).toHaveAttribute("data-separator", "hover"));
		const line = el.firstElementChild as HTMLElement;
		await expect(line.getBoundingClientRect().width).toBe(2);
		await expectTokenColour(line, "background-color", "bg-border-control");
	},
};

/** A remembered layout from the caller is restored: the inspector opens at 45%. */
export const RememberedLayout: Story = {
	args: { defaultLayout: { canvas: 55, inspector: 45 } },
	play: async ({ canvasElement }) => {
		const group = handle(canvasElement).parentElement as HTMLElement;
		const share =
			panel(canvasElement, "inspector").getBoundingClientRect().width /
			group.getBoundingClientRect().width;
		await expect(Math.round(share * 100)).toBe(45);
	},
};

/**
 * Keyboard (window splitter): Tab reaches the handle and shows the focus ring; ArrowLeft grows the inspector;
 * Home and End stop at the panels' limits; each change is reported for the caller to remember.
 */
export const Keyboard: Story = {
	play: async ({ canvasElement, args }) => {
		const el = handle(canvasElement);
		await tabTo(el);
		// Not a React Aria element: the ring is drawn on :focus-visible (keyboard focus only).
		await expect(el.matches(":focus-visible")).toBe(true);
		const ring = getComputedStyle(el);
		await expect(ring.outlineStyle).toBe("solid");
		await expect(ring.outlineWidth).toBe("2px");
		await expect(ring.outlineOffset).toBe("2px");
		const before = Number(el.getAttribute("aria-valuenow"));
		await userEvent.keyboard("{ArrowLeft}");
		await waitFor(() =>
			expect(Number(el.getAttribute("aria-valuenow"))).toBeLessThan(before),
		);
		await waitFor(() => expect(args.onLayoutChange).toHaveBeenCalled());
		const layout = (args.onLayoutChange as ReturnType<typeof fn>).mock
			.lastCall?.[0] as Record<string, number>;
		await expect(Object.keys(layout).sort()).toEqual(["canvas", "inspector"]);
		await expect(layout.inspector).toBeGreaterThan(30);
		await userEvent.keyboard("{Home}");
		await waitFor(() =>
			expect(Number(el.getAttribute("aria-valuenow"))).toBe(30),
		);
		await userEvent.keyboard("{End}");
		await waitFor(() =>
			expect(Number(el.getAttribute("aria-valuenow"))).toBe(80),
		);
	},
};

/** Stacked: the shell's bottom panel. The rule runs across. */
export const Vertical: Story = {
	args: { orientation: "vertical", id: "shell" },
	render: (args) => (
		<div className="h-80 w-full max-w-3xl border border-border-default">
			<ResizablePanels {...args}>
				<ResizablePanel id="main" defaultSize="70%">
					<div className="p-4">Canvas</div>
				</ResizablePanel>
				<ResizableHandle aria-label="Resize the bottom panel" />
				<ResizablePanel id="bottom" defaultSize="30%" minSize="15%">
					<div className="p-4">Problems</div>
				</ResizablePanel>
			</ResizablePanels>
		</div>
	),
	play: async ({ canvasElement }) => {
		const el = within(canvasElement).getByRole("separator", {
			name: "Resize the bottom panel",
		});
		await expect(el.getBoundingClientRect().height).toBe(1);
		await expect(el.getBoundingClientRect().width).toBeGreaterThan(100);
	},
};
