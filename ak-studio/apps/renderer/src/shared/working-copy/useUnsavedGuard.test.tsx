// The unsaved guard in a real router (memory history): while dirty, leaving the route is held until the view
// answers, the page's unload is refused, and main is told the label; once clean, nothing is held.
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
	useNavigate,
} from "@tanstack/react-router";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setTransport } from "../bridge/client";
import { createMockTransport } from "../bridge/mockTransport";
import { UNSAVED_REPORT_DELAY_MS, unsavedWork } from "./unsaved";
import { useUnsavedBlocker, useUnsavedLabel } from "./useUnsavedGuard";

function Editor() {
	const [dirty, setDirty] = useState(false);
	useUnsavedLabel("Config: session section", dirty);
	const guard = useUnsavedBlocker(dirty);
	const navigate = useNavigate();
	return (
		<div>
			<button type="button" onClick={() => setDirty(true)}>
				Edit
			</button>
			<button type="button" onClick={() => setDirty(false)}>
				Save
			</button>
			<button
				type="button" // The app registers its own routes; this test router has others.
				onClick={() => void navigate({ to: "/other" } as never)}
			>
				Leave
			</button>
			<p>{guard.status === "blocked" ? "Asking" : "Not asking"}</p>
			{guard.status === "blocked" ? (
				<>
					<button type="button" onClick={guard.reset}>
						Stay
					</button>
					<button type="button" onClick={guard.proceed}>
						Discard and leave
					</button>
				</>
			) : null}
		</div>
	);
}

function renderApp() {
	const rootRoute = createRootRoute({ component: Outlet });
	const routeTree = rootRoute.addChildren([
		createRoute({
			getParentRoute: () => rootRoute,
			path: "/",
			component: Editor,
		}),
		createRoute({
			getParentRoute: () => rootRoute,
			path: "/other",
			component: () => <p>Other view</p>,
		}),
	]);
	const router = createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});
	render(<RouterProvider router={router} />);
	return router;
}

function unload(): "refused" | "allowed" {
	const event = new Event("beforeunload", { cancelable: true });
	window.dispatchEvent(event);
	return event.defaultPrevented ? "refused" : "allowed";
}

afterEach(() => {
	setTransport(undefined);
});

describe("useUnsavedLabel and useUnsavedBlocker", () => {
	it("lets the person leave and unload freely while nothing is unsaved", async () => {
		setTransport(createMockTransport());
		const user = userEvent.setup();
		renderApp();
		await user.click(await screen.findByRole("button", { name: "Leave" }));
		expect(await screen.findByText("Other view")).toBeTruthy();
		expect(unload()).toBe("allowed");
	});

	it("holds leaving the route while dirty, until the view's answer", async () => {
		setTransport(createMockTransport());
		const user = userEvent.setup();
		const router = renderApp();
		await user.click(await screen.findByRole("button", { name: "Edit" }));
		await user.click(screen.getByRole("button", { name: "Leave" }));
		expect(await screen.findByText("Asking")).toBeTruthy();
		expect(router.state.location.pathname).toBe("/");
		await user.click(screen.getByRole("button", { name: "Stay" }));
		expect(await screen.findByText("Not asking")).toBeTruthy();
		expect(router.state.location.pathname).toBe("/");
		await user.click(screen.getByRole("button", { name: "Leave" }));
		await user.click(
			await screen.findByRole("button", { name: "Discard and leave" }),
		);
		expect(await screen.findByText("Other view")).toBeTruthy();
		// The view is gone, and with it what was unsaved.
		expect(unsavedWork.items()).toEqual([]);
		expect(unload()).toBe("allowed");
	});

	it("refuses the page's unload while dirty, and tells main the label", async () => {
		vi.useFakeTimers();
		try {
			const setUnsaved = vi.fn(() => ({}));
			setTransport(
				createMockTransport({ handlers: { "app.setUnsaved": setUnsaved } }),
			);
			const flush = () =>
				act(async () => {
					await vi.advanceTimersByTimeAsync(0);
				});
			renderApp();
			await flush();
			fireEvent.click(screen.getByRole("button", { name: "Edit" }));
			await flush();
			expect(unload()).toBe("refused");
			expect(unsavedWork.items()).toEqual(["Config: session section"]);
			await act(async () => {
				await vi.advanceTimersByTimeAsync(UNSAVED_REPORT_DELAY_MS);
			});
			expect(setUnsaved).toHaveBeenCalledExactlyOnceWith({
				items: ["Config: session section"],
			});
			fireEvent.click(screen.getByRole("button", { name: "Save" }));
			await flush();
			expect(unload()).toBe("allowed");
			// The last item clearing is told at once, not after the pause.
			expect(setUnsaved).toHaveBeenLastCalledWith({ items: [] });
		} finally {
			vi.useRealTimers();
		}
	});
});
