// SessionControl over a real session: the About ticker through the mock transport (its service behind a real
// registry, a FakeClock for its ticks), followed through the events subscription into the session store. Start and
// stop through the one button, the key facts from the session's info, a start the service refuses, a failed
// session's own error, and "Show log" through an app command.
import type { Session } from "@ak-studio/contract";
import { FakeClock } from "@ak-studio/runtime";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type ConnectedMock, connectMock } from "../../test/connectedMock";
import { defineCommand } from "../commands/command";
import { getCommands, setCommands } from "../commands/runCommand";
import { applySessions } from "../sessions/sessionStore";
import { SessionControl } from "./SessionControl";

const appCommands = getCommands();
let mock: ConnectedMock | undefined;
afterEach(async () => {
	setCommands(appCommands);
	await mock?.backend.sessions.stopAll();
	mock?.dispose();
	mock = undefined;
});

/** The ticker's start time, once its info has arrived (none while it starts). */
const facts = (session: Session) => {
	const info = session.info as { startedAt: number } | undefined;
	return info ? [{ label: "Started at", value: String(info.startedAt) }] : [];
};

function show(props: Partial<Parameters<typeof SessionControl>[0]> = {}) {
	const clock = new FakeClock(5_000);
	mock = connectMock({ clock });
	const Wrapper = mock.wrapper;
	render(
		<Wrapper>
			<SessionControl
				kind="about.ticker"
				title="Demo ticker"
				facts={facts}
				{...props}
			/>
		</Wrapper>,
	);
	return screen.getByRole("region", { name: "Demo ticker" });
}

describe("SessionControl", () => {
	it("reads as stopped with no session, starts it, shows its facts, and stops it with the same button", async () => {
		const user = userEvent.setup();
		const region = show();
		expect(region.textContent).toContain("Stopped");
		const button = within(region).getByRole("button", { name: "Start" });
		await user.click(button);
		await waitFor(() => expect(region.textContent).toContain("Running"));
		expect(within(region).getByText("5000").tagName).toBe("DD");
		// The one button, now "Stop", keeps focus.
		expect(within(region).getByRole("button", { name: "Stop" })).toBe(button);
		expect(button).toBe(document.activeElement);
		await user.click(button);
		await waitFor(() => expect(region.textContent).toContain("Stopped"));
		expect(within(region).getByRole("button", { name: "Start" })).toBe(button);
		expect(within(region).queryByText("5000")).toBeNull();
	});

	it("says inline why a start was refused", async () => {
		const user = userEvent.setup();
		const region = show({ args: { burst: "many" } });
		await user.click(within(region).getByRole("button", { name: "Start" }));
		const alert = await within(region).findByRole("alert");
		expect(alert.textContent).not.toBe("");
		expect(region.textContent).toContain("Stopped");
	});

	it("shows a failed session's own error, and Show log runs the log command when it is declared", async () => {
		const user = userEvent.setup();
		const showLog = vi.fn();
		setCommands([
			...appCommands,
			defineCommand({
				id: "about.showTickerLog",
				title: "Show log",
				run: showLog,
			}),
		]);
		const region = show({ logCommand: "about.showTickerLog" });
		act(() =>
			applySessions([
				{
					id: "s1",
					kind: "about.ticker",
					state: "failed",
					commandIds: [],
					seq: 9,
					error: { code: "session.failed", message: "Start it again." },
				},
			]),
		);
		await waitFor(() => expect(region.textContent).toContain("Failed"));
		expect(within(region).getByRole("alert").textContent).toContain(
			"Start it again.",
		);
		await user.click(within(region).getByRole("button", { name: "Show log" }));
		expect(showLog).toHaveBeenCalledOnce();
		expect(within(region).getByRole("button", { name: "Start" })).toBeTruthy();
	});

	it("offers no Show log for a command no manifest declares", () => {
		const region = show({ logCommand: "about.noSuchCommand" });
		expect(
			within(region).queryByRole("button", { name: "Show log" }),
		).toBeNull();
	});
});
