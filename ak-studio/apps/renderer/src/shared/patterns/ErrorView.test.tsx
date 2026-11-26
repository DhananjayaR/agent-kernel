// ErrorView places any StudioError by the error catalogue's placement (or the view's own): a banner (inline or for
// a view) with the catalogue's title, the error's message, the file and line, the detail collapsed and the next
// action, run through runReported with its arguments (a failure of it is reported); the centred frame when nothing is
// left to show; and a toast raised once per error (StrictMode and re-renders do not raise it again), rendering
// nothing in place.
import { ERROR_CODES, type StudioError } from "@ak-studio/contract";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { defineCommand } from "../commands/command";
import { getCommands, setCommands } from "../commands/runCommand";
import { bindCommandFailureReporter } from "../commands/runReported";
import { errorStrings } from "../errors/strings";
import { ErrorView } from "./ErrorView";
import { bindFailureNotice } from "./failureNotice";

const appCommands = getCommands();
afterEach(() => {
	setCommands(appCommands);
	vi.restoreAllMocks();
});

const cannotRead: StudioError = {
	code: ERROR_CODES.fileNotFound,
	message: "Fix the syntax error, then the canvas reads the file again.",
	file: "src/support/app.py",
	line: 42,
	detail: "SyntaxError: invalid syntax (app.py, line 42)",
	action: {
		label: "Open in Code",
		commandId: "code.revealFile",
		args: { file: "src/support/app.py", line: 42 },
	},
};

describe("ErrorView", () => {
	it("shows a banner with the catalogue's title, the message, the file and line, the detail collapsed, and the action", async () => {
		const run = vi.fn();
		setCommands([
			defineCommand({
				id: "code.revealFile",
				title: "Reveal a file",
				args: z.strictObject({ file: z.string(), line: z.number() }),
				run,
			}),
		]);
		const user = userEvent.setup();
		render(<ErrorView error={cannotRead} />);
		const alert = screen.getByRole("alert");
		expect(alert.textContent).toContain(errorStrings.titles.fileNotFound);
		expect(alert.textContent).toContain(cannotRead.message);
		expect(alert.dataset.kind).toBe("cannot-read");
		expect(alert.textContent).toContain("src/support/app.py, line 42");
		const details = within(alert).getByRole("button", { name: "Details" });
		expect(details.getAttribute("aria-expanded")).toBe("false");
		await user.click(
			within(alert).getByRole("button", { name: "Open in Code" }),
		);
		await vi.waitFor(() =>
			expect(run).toHaveBeenCalledExactlyOnceWith({
				file: "src/support/app.py",
				line: 42,
			}),
		);
	});

	it("reports a next action that fails, rather than dropping it", async () => {
		setCommands([
			defineCommand({
				id: "code.revealFile",
				title: "Reveal a file",
				args: z.unknown(),
				run: () => Promise.reject(new Error("no such file")),
			}),
		]);
		const report = vi.fn();
		const unbind = bindCommandFailureReporter(report);
		const user = userEvent.setup();
		render(<ErrorView error={cannotRead} />);
		await user.click(screen.getByRole("button", { name: "Open in Code" }));
		await vi.waitFor(() =>
			expect(report).toHaveBeenCalledWith("code.revealFile", expect.any(Error)),
		);
		unbind();
	});

	it("uses the centred frame when nothing is left to show, and the view's placement over the catalogue's", () => {
		const { rerender } = render(
			<ErrorView
				error={{ code: ERROR_CODES.projectNotOpen, message: "Open a project." }}
				frame="centred"
			/>,
		);
		const alert = screen.getByRole("alert");
		expect(alert.dataset.slot).toBe("state-message");
		expect(
			within(alert).getByRole("heading", {
				name: errorStrings.titles.projectNotOpen,
			}),
		).toBeTruthy();
		// A toast-placed code shown in the view, because the view says so.
		rerender(
			<ErrorView
				error={{
					code: ERROR_CODES.preferencesNotSaved,
					message: "Try again.",
				}}
				placement="banner"
			/>,
		);
		expect(screen.getByRole("alert").textContent).toContain(
			errorStrings.titles.preferencesNotSaved,
		);
	});

	it("raises a toast-placed error once through the failure notice, with its action, and renders nothing", () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const notify = vi.fn();
		const unbind = bindFailureNotice(notify);
		const error: StudioError = {
			code: ERROR_CODES.preferencesNotSaved,
			message: "Your layout will be saved the next time you change it.",
			action: { label: "Try again", commandId: "shell.toggleBottomPanel" },
		};
		const { container, rerender } = render(
			<StrictMode>
				<ErrorView error={error} />
			</StrictMode>,
		);
		rerender(
			<StrictMode>
				<ErrorView error={error} />
			</StrictMode>,
		);
		expect(container.textContent).toBe("");
		expect(notify).toHaveBeenCalledOnce();
		expect(notify.mock.calls[0]?.[0]).toMatchObject({
			title: errorStrings.titles.preferencesNotSaved,
			description: error.message,
			action: { label: "Try again" },
		});
		// The same error as a new object (a parent's inline literal) is not raised again; a different one is.
		rerender(
			<StrictMode>
				<ErrorView error={{ ...error }} />
			</StrictMode>,
		);
		expect(notify).toHaveBeenCalledOnce();
		rerender(
			<StrictMode>
				<ErrorView error={{ ...error, message: "Try again later." }} />
			</StrictMode>,
		);
		expect(notify).toHaveBeenCalledTimes(2);
		unbind();
	});
});
