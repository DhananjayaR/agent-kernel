// Each tab's screen, mounted the way the router mounts it (from the registry's routes): in P1b every tab still shows
// its empty state, titled with the tab's label and naming the phase that fills it (P4-P12.md, P3.md), in final
// copy.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { registry } from "./registry";

const PHASES: Record<string, readonly string[]> = {
	canvas: ["P3"],
	code: ["P3"],
	config: ["P3"],
	"test-trace": ["P8", "P9"],
	deploy: ["P10"],
};

function renderTab(path: string) {
	const route = registry.routes.find((r) => r.path === path);
	if (!route) throw new Error(`no route at ${path}`);
	const Screen = route.component;
	return render(<Screen />);
}

describe("each tab's screen", () => {
	it("shows its empty state, titled with the tab's label, naming the phase that fills it", () => {
		expect(registry.tabs.map((tab) => tab.id)).toEqual(Object.keys(PHASES));
		for (const tab of registry.tabs) {
			const view = renderTab(tab.path);
			const heading = screen.getByRole("heading", { level: 2 });
			expect(heading.textContent).toBe(tab.label);
			for (const phase of PHASES[tab.id] ?? [])
				expect(view.container.textContent).toContain(phase);
			view.unmount();
		}
	});

	it("has final copy: sentence case titles, no placeholder text", () => {
		for (const tab of registry.tabs) {
			const view = renderTab(tab.path);
			const title = tab.label;
			expect(title.slice(1)).toBe(title.slice(1).toLowerCase());
			expect(view.container.textContent).not.toMatch(
				/\[|TODO|lorem|placeholder/i,
			);
			view.unmount();
		}
	});
});
