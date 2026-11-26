// The app's one keydown listener for app command shortcuts (not one per command), mounted once by the shell. A key
// press is named the way shortcuts resolve on the platform (shortcuts.ts) and looked up. It acts only when:
// - nothing claimed the press first (defaultPrevented), and it is not a key held down or a press while composing
//   text with an input method;
// - no modal is open (P1b-plan ruling 13). The signal is the design system's: an open `Modal` renders its React
//   Aria ModalOverlay with data-slot="modal-overlay" (isModalOpen, @ak-studio/ui), and any other dialog marked
//   aria-modal counts too. React Aria sets no aria-modal itself, and its inert or aria-hidden marking of the page
//   differs between browsers and test DOMs, so neither is relied on;
// - focus is not in a text field, unless the command opts in (`whileTyping`);
// - the command's `when` is true.
// Then the press is claimed (preventDefault) and the command runs through runCommand; a failure, or a version-gated
// command's refusal, is reported (patterns/failureNotice.ts: logged, and the Shell shows it in a toast).
import { isModalOpen } from "@ak-studio/ui";
import { useEffect, useMemo } from "react";
import { runReported } from "../patterns/failureNotice";
import type { AppCommand } from "./command";
import {
	buildShortcutMap,
	eventShortcut,
	type ShortcutPlatform,
} from "./shortcuts";

const NOT_TEXT_INPUTS = new Set([
	"button",
	"checkbox",
	"color",
	"file",
	"hidden",
	"image",
	"radio",
	"range",
	"reset",
	"submit",
]);

/** True when `target` takes typed text: a text-like input, a textarea or editable content. */
export function isTextEntry(target: EventTarget | null): boolean {
	if (!(target instanceof Element)) return false;
	if (target instanceof HTMLTextAreaElement) return true;
	if (target instanceof HTMLInputElement)
		return !NOT_TEXT_INPUTS.has(target.type);
	return target instanceof HTMLElement && target.isContentEditable;
}

/** Listens for the commands' shortcuts on `platform`, once for all of them, while mounted. */
export function useAppShortcuts(
	commands: readonly AppCommand[],
	platform: ShortcutPlatform,
): void {
	const shortcuts = useMemo(
		() => buildShortcutMap(commands, platform),
		[commands, platform],
	);
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.defaultPrevented || event.repeat || event.isComposing) return;
			const name = eventShortcut(event);
			const command = name === undefined ? undefined : shortcuts.get(name);
			if (!command) return;
			if (!command.whileTyping && isTextEntry(event.target)) return;
			if (isModalOpen(document)) return;
			if (command.when && !command.when()) return;
			event.preventDefault();
			// A failure (or a version-gated command's refusal) is reported: the Shell shows it in a toast.
			runReported(command.id);
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [shortcuts]);
}
