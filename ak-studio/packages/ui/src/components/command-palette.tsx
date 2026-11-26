// CommandPaletteView: every app command in one searchable list (the command palette pattern; P1b design gate row
// (b), signed off 26 November 2026). Presentational: the connected CommandPalette (the renderer's shared/patterns)
// builds the items from the app's command list and opens it on Mod+K.
//
// - **Placement.** An overlay near the top of the window, centred, Dialog size L (640 px): ModalLayer, so it is a
//   modal (app shortcuts do not act while it is open) and focus returns to what had it when it closes.
// - **One flat list,** in the order given (manifest order), each title with its feature's name as a prefix ("About:
//   Run the demo job"). Rows are the standard 40 px; each command's shortcut is right-aligned in monospace, in the
//   platform's form ("Ctrl+J", "⌘J").
// - **A version-gated command** is listed, not runnable, with its reason where the shortcut would be ("Needs OAK
//   0.12.0"): it can still be reached with the arrow keys, and the reason is read with it, but Enter on it does
//   nothing. (Commands whose `when` is false are left out by the caller.)
// - **Keyboard** (React Aria Autocomplete over a Menu): typing filters (case and accents ignored, anywhere in the
//   title) and moves to the first match; ArrowUp and ArrowDown move through the matches (wrapping); Enter runs the
//   one moved to, or the first match when none is (after Backspace, say); Escape closes; Tab stays inside.
// - **Running.** The palette closes first, then runs the command, so the focus it gives back does not fight
//   where the command moves it.
// - **Colour.** Shortcuts and reasons are in the text colour: muted text fails contrast on a focused row's fill.

import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import {
	Autocomplete,
	Input,
	type Key,
	Keyboard,
	Menu,
	MenuItem,
	Text,
	TextField,
	useFilter,
} from "react-aria-components";
import { cn } from "../lib/utils";
import { type CommandPaletteStrings, uiStrings } from "../strings";
import { ModalLayer } from "./modal";

/** One command as the palette lists it. */
export type CommandPaletteItem = {
	/** The command's id: what `onRun` gets. */
	id: string;
	/** Its title with its feature's prefix: "About: Run the demo job". What typing matches. */
	title: string;
	/** Its shortcut as shown ("Ctrl+J"), and in aria-keyshortcuts form ("Control+J"). */
	shortcut?: { label: string; aria: string };
	/** Why it cannot run here ("Needs OAK 0.12.0"): listed, not runnable. */
	unavailable?: string;
};

export type CommandPaletteViewProps = {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	/** Every command that applies here, in order. */
	items: readonly CommandPaletteItem[];
	/** Runs a command, after the palette has closed. */
	onRun: (id: string) => void;
	/** The search text to open with (stories). */
	defaultQuery?: string;
	/** Overrides of the default copy (strings.ts). */
	strings?: Partial<CommandPaletteStrings>;
};

export function CommandPaletteView({
	isOpen,
	onOpenChange,
	items,
	onRun,
	defaultQuery = "",
	strings,
}: CommandPaletteViewProps) {
	const text = { ...uiStrings.commandPalette, ...strings };
	return (
		<ModalLayer
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={text.title}
			placement="top"
			size="l"
			isDismissable
			className="overflow-hidden"
		>
			{/* Mounted with the dialog: each opening starts from the default query. */}
			<PaletteBody
				items={items}
				onRun={(id) => {
					onOpenChange(false);
					onRun(id);
				}}
				defaultQuery={defaultQuery}
				text={text}
			/>
		</ModalLayer>
	);
}

function PaletteBody({
	items,
	onRun,
	defaultQuery,
	text,
}: {
	items: readonly CommandPaletteItem[];
	onRun: (id: string) => void;
	defaultQuery: string;
	text: CommandPaletteStrings;
}) {
	const [query, setQuery] = useState(defaultQuery);
	const { contains } = useFilter({ sensitivity: "base" });
	const matches = useMemo(
		() => items.filter((item) => contains(item.title, query.trim())),
		[items, query, contains],
	);
	const inputRef = useRef<HTMLInputElement>(null);

	const run = (key: Key) => {
		const item = matches.find((match) => match.id === key);
		if (item && item.unavailable === undefined) onRun(item.id);
	};

	// Enter with no row moved to (nothing typed yet, or after Backspace, which React Aria answers by leaving the
	// list) runs the first match. With a row moved to, React Aria runs that row.
	const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
		if (event.target !== inputRef.current) return;
		// A row moved to is marked at once (the input's aria-activedescendant follows a moment later).
		if (event.currentTarget.querySelector("[role=menuitem][data-focused]"))
			return;
		event.preventDefault();
		event.stopPropagation();
		const first = matches[0];
		if (first) run(first.id);
	};

	return (
		<div
			data-slot="command-palette"
			className="flex min-h-0 flex-col"
			onKeyDownCapture={onKeyDownCapture}
		>
			<Autocomplete inputValue={query} onInputChange={setQuery}>
				<TextField
					aria-label={text.search}
					autoFocus
					className="shrink-0 border-b border-border-default"
				>
					<Input
						ref={inputRef}
						placeholder={text.placeholder}
						className="h-control-xl w-full bg-transparent px-4 text-ui-lg text-text outline-none placeholder:text-text-muted"
					/>
				</TextField>
				<Menu
					aria-label={text.commands}
					items={matches}
					onAction={run}
					className="max-h-96 overflow-y-auto p-popover outline-none"
					renderEmptyState={() => (
						<p className="flex min-h-row items-center px-edge text-ui text-text">
							{text.noMatches}
						</p>
					)}
				>
					{(item) => (
						<MenuItem
							id={item.id}
							textValue={item.title}
							data-unavailable={item.unavailable === undefined ? undefined : ""}
							className={cn(
								"relative flex min-h-row w-full cursor-default items-center gap-4 rounded-control px-edge",
								"text-ui text-text outline-none select-none",
								"data-hovered:bg-fill-hover data-focused:bg-fill-hover focus-ring-inset",
							)}
						>
							<Text slot="label" className="min-w-0 flex-1 truncate">
								{item.title}
							</Text>
							{item.unavailable !== undefined ? (
								<Text
									slot="description"
									className="shrink-0 text-ui-sm text-text"
								>
									{item.unavailable}
								</Text>
							) : item.shortcut ? (
								<Keyboard
									aria-keyshortcuts={item.shortcut.aria}
									className="shrink-0 font-mono text-ui-sm text-text"
								>
									{item.shortcut.label}
								</Keyboard>
							) : null}
						</MenuItem>
					)}
				</Menu>
			</Autocomplete>
		</div>
	);
}
