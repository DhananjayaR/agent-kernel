// The navigation port the Shell binds for features' commands: unbound, nothing can navigate (a command's `when` is
// false); bound, a path goes to the Shell's navigate; a stale unbind leaves a newer binding alone.
import { afterEach, describe, expect, it, vi } from "vitest";
import { bindNavigate, canNavigate, navigateTo } from "./navigation";

let unbind: (() => void) | undefined;
afterEach(() => {
	unbind?.();
	unbind = undefined;
});

describe("navigation", () => {
	it("cannot navigate until a shell binds, and throws if asked to", () => {
		expect(canNavigate()).toBe(false);
		expect(() => navigateTo("/about")).toThrow("no shell is mounted");
	});

	it("sends the path to the bound navigate, until unbound", () => {
		const navigate = vi.fn();
		unbind = bindNavigate(navigate);
		expect(canNavigate()).toBe(true);
		navigateTo("/about");
		expect(navigate).toHaveBeenCalledWith("/about");
		unbind();
		expect(canNavigate()).toBe(false);
	});

	it("keeps a newer binding when an older one unbinds", () => {
		const first = bindNavigate(vi.fn());
		const second = vi.fn();
		unbind = bindNavigate(second);
		first();
		navigateTo("/canvas");
		expect(second).toHaveBeenCalledWith("/canvas");
	});
});
