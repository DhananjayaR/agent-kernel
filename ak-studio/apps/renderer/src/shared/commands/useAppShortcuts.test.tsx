// The app's one keydown listener (happy-dom): a key press runs the command its shortcut resolves to on the
// platform (Mod is Cmd on macOS, Ctrl elsewhere), and nothing else; never while a modal is open, never while focus
// is in a text field unless the command opts in, never for a key held down, and not when the command's `when` is
// false.
import { Modal } from "@ak-studio/ui";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type AppCommand, defineCommand } from "./command";
import { setCommands } from "./runCommand";
import type { ShortcutPlatform } from "./shortcuts";
import { useAppShortcuts } from "./useAppShortcuts";

function Harness({
	commands,
	platform,
	children,
}: {
	commands: readonly AppCommand[];
	platform: ShortcutPlatform;
	children?: React.ReactNode;
}) {
	useAppShortcuts(commands, platform);
	return <>{children}</>;
}

function setup(
	platform: ShortcutPlatform,
	extra: Partial<Parameters<typeof defineCommand>[0]> = {},
	children?: React.ReactNode,
) {
	const run = vi.fn();
	const commands = [
		defineCommand({
			id: "shell.toggleBottomPanel",
			title: "Show or hide the panel",
			shortcut: "Mod+J",
			run,
			...extra,
		}),
	];
	setCommands(commands);
	const view = render(
		<Harness commands={commands} platform={platform}>
			{children}
		</Harness>,
	);
	return { run, view };
}

afterEach(() => {
	setCommands([]);
	vi.restoreAllMocks();
});

describe("useAppShortcuts", () => {
	it("runs Mod+J as Ctrl+J on Linux and Windows, and not Cmd+J", () => {
		const { run } = setup("other");
		fireEvent.keyDown(document.body, { key: "j", metaKey: true });
		expect(run).not.toHaveBeenCalled();
		fireEvent.keyDown(document.body, { key: "j", ctrlKey: true });
		expect(run).toHaveBeenCalledOnce();
	});

	it("runs Mod+J as Cmd+J on macOS, and not Ctrl+J", () => {
		const { run } = setup("mac");
		fireEvent.keyDown(document.body, { key: "j", ctrlKey: true });
		expect(run).not.toHaveBeenCalled();
		fireEvent.keyDown(document.body, { key: "j", metaKey: true });
		expect(run).toHaveBeenCalledOnce();
	});

	it("needs the exact modifiers, and claims the key press it acts on", () => {
		const { run } = setup("other");
		fireEvent.keyDown(document.body, {
			key: "j",
			ctrlKey: true,
			shiftKey: true,
		});
		fireEvent.keyDown(document.body, { key: "j", ctrlKey: true, altKey: true });
		fireEvent.keyDown(document.body, { key: "j" });
		expect(run).not.toHaveBeenCalled();
		const unclaimed = fireEvent.keyDown(document.body, {
			key: "j",
			ctrlKey: true,
		});
		expect(unclaimed).toBe(false); // preventDefault was called
	});

	it("ignores a key held down, a key press something else claimed, and a press while composing text", () => {
		const { run } = setup("other");
		fireEvent.keyDown(document.body, { key: "j", ctrlKey: true, repeat: true });
		fireEvent.keyDown(document.body, {
			key: "j",
			ctrlKey: true,
			isComposing: true,
		});
		const claimed = new KeyboardEvent("keydown", {
			key: "j",
			ctrlKey: true,
			bubbles: true,
			cancelable: true,
		});
		claimed.preventDefault();
		document.body.dispatchEvent(claimed);
		expect(run).not.toHaveBeenCalled();
	});

	it("does nothing while a modal is open", () => {
		const { run } = setup(
			"other",
			{},
			<Modal isOpen onOpenChange={() => {}} title="Settings">
				<button type="button">Inside</button>
			</Modal>,
		);
		const inside = screen.getByRole("button", { name: "Inside" });
		fireEvent.keyDown(inside, { key: "j", ctrlKey: true });
		fireEvent.keyDown(document.body, { key: "j", ctrlKey: true });
		expect(run).not.toHaveBeenCalled();
	});

	it("does nothing while focus is in a text field, unless the command opts in", () => {
		const fields = (
			<>
				<input aria-label="Name" />
				<textarea aria-label="Notes" />
				<div
					data-testid="editor"
					contentEditable
					suppressContentEditableWarning
				/>
				<input aria-label="Agree" type="checkbox" />
			</>
		);
		const { run, view } = setup("other", {}, fields);
		for (const name of ["Name", "Notes"])
			fireEvent.keyDown(screen.getByLabelText(name), {
				key: "j",
				ctrlKey: true,
			});
		const editor = screen.getByTestId("editor");
		Object.defineProperty(editor, "isContentEditable", { value: true });
		fireEvent.keyDown(editor, { key: "j", ctrlKey: true });
		expect(run).not.toHaveBeenCalled();
		// A checkbox is not a text field.
		fireEvent.keyDown(screen.getByLabelText("Agree"), {
			key: "j",
			ctrlKey: true,
		});
		expect(run).toHaveBeenCalledOnce();
		view.unmount();

		const optedIn = setup("other", { whileTyping: true }, fields);
		fireEvent.keyDown(screen.getByLabelText("Name"), {
			key: "j",
			ctrlKey: true,
		});
		expect(optedIn.run).toHaveBeenCalledOnce();
	});

	it("does nothing when the command's `when` is false, and leaves the key press alone", () => {
		const { run } = setup("other", { when: () => false });
		const unclaimed = fireEvent.keyDown(document.body, {
			key: "j",
			ctrlKey: true,
		});
		expect(unclaimed).toBe(true);
		expect(run).not.toHaveBeenCalled();
	});

	it("logs a command that fails, and keeps listening", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		let calls = 0;
		setup("other", {
			run: () => {
				calls += 1;
				throw new Error("disk full");
			},
		});
		await act(async () => {
			fireEvent.keyDown(document.body, { key: "j", ctrlKey: true });
		});
		expect(error).toHaveBeenCalledWith(
			"[studio] command shell.toggleBottomPanel failed: disk full",
		);
		await act(async () => {
			fireEvent.keyDown(document.body, { key: "j", ctrlKey: true });
		});
		expect(calls).toBe(2);
	});

	it("adds one keydown listener for every command, and removes it on unmount", () => {
		const add = vi.spyOn(document, "addEventListener");
		const remove = vi.spyOn(document, "removeEventListener");
		const commands = ["a.one", "a.two", "a.three"].map((id, i) =>
			defineCommand({ id, title: id, shortcut: `Mod+${i + 1}`, run: () => {} }),
		);
		setCommands(commands);
		const view = render(<Harness commands={commands} platform="other" />);
		const keydowns = () =>
			add.mock.calls.filter(([type]) => type === "keydown").length;
		expect(keydowns()).toBe(1);
		view.unmount();
		expect(
			remove.mock.calls.filter(([type]) => type === "keydown"),
		).toHaveLength(1);
	});
});
