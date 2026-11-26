// The shell's error paths, rendered in the providers the app uses (App: query client, theme, router) against a
// transport that fails on purpose: the layout-save toast (a background notice; the layout stays as the person set
// it) and the bridge-error banner (shows the failure's message).
import { studioError } from "@ak-studio/contract";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudioFailure, setTransport } from "../../shared/bridge/client";
import { createMockTransport } from "../../shared/bridge/mockTransport";
import { App } from "../App";
import { shellStrings } from "./strings";

afterEach(() => {
	setTransport(undefined);
	vi.restoreAllMocks();
});

describe("Shell error paths", () => {
	it("tells the person when the layout could not be saved, and keeps the layout they set", async () => {
		const failures = vi.fn();
		setTransport(
			createMockTransport({
				handlers: {
					"app.setLayout": () => {
						failures();
						throw new StudioFailure(
							studioError("app.preferencesNotSaved", "Disk full"),
						);
					},
				},
			}),
		);
		const user = userEvent.setup();
		render(<App />);

		// The panel starts open (the default layout); hiding it is the person's layout change.
		await user.click(
			await screen.findByRole("button", { name: "Hide the panel" }),
		);

		expect(
			await screen.findByText(shellStrings.layoutNotSaved.title),
		).toBeTruthy();
		expect(failures).toHaveBeenCalledOnce();
		// Not reverted: the panel stays hidden although the save failed.
		expect(screen.getByRole("button", { name: "Show the panel" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Hide the panel" })).toBeNull();
	});

	it("shows the bridge error's message in a banner when app.info fails", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		setTransport(
			createMockTransport({
				handlers: {
					"app.info": () => {
						throw new StudioFailure(
							studioError("app.unavailable", "The bridge did not answer"),
						);
					},
				},
			}),
		);
		render(<App />);

		expect(await screen.findByText("The bridge did not answer")).toBeTruthy();
		expect(screen.getByText(shellStrings.bridgeError)).toBeTruthy();
	});
});
