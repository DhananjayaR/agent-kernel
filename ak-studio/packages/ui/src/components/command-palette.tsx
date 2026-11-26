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
//   0.12.0"): it can be marked with the arrow keys and its reason is read with it (aria-disabled, so a screen reader
//   says it is unavailable). Enter or a click on it runs nothing and says the reason again (a polite status).
//   (Commands whose `when` is false are left out by the caller.)
// - **Keyboard** (the APG editable combobox with a list: a React Aria TextField whose input owns the list through
//   aria-activedescendant). Typing filters (case and accents ignored, anywhere in the title). One row is always
//   marked while anything matches: the first runnable match, on opening and after every change to the text
//   (Backspace too), so Enter never acts on a row that is not shown as marked. ArrowUp and ArrowDown move the mark
//   (wrapping); Enter runs the marked row, and does nothing when nothing matches; Escape closes; Tab stays inside.
//   The pointer marks the row it moves over and a click runs it. The mark is the row's fill and the inset focus
//   ring. The search field shows focus as Input does: its edge in the text colour, and the focus ring when focus came
//   by keyboard (the app opens the palette with Mod+K).
// - **Running.** The palette closes first, then runs the command, so the focus it gives back does not fight
//   where the command moves it.
// - **Colour.** Shortcuts and reasons are in the text colour: muted text fails contrast on a marked row's fill.

import {
	type KeyboardEvent,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { Input, TextField, useFilter } from "react-aria-components";
import { motion } from "../lib/styles";
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
	const listId = useId();
	const [query, setQuery] = useState(defaultQuery);
	const { contains } = useFilter({ sensitivity: "base" });
	const matches = useMemo(
		() => items.filter((item) => contains(item.title, query.trim())),
		[items, query, contains],
	);
	// The marked row: the first runnable match whenever the matches change, else the first match.
	const firstMark = useMemo(() => {
		const runnable = matches.findIndex(
			(item) => item.unavailable === undefined,
		);
		return matches.length === 0 ? -1 : Math.max(0, runnable);
	}, [matches]);
	const [mark, setMark] = useState(firstMark);
	const [markFor, setMarkFor] = useState(matches);
	if (markFor !== matches) {
		setMarkFor(matches);
		setMark(firstMark);
	}
	const marked = matches[mark];
	// Said (politely) when Enter or a click lands on a gated row: it cannot run, and why.
	const [refused, setRefused] = useState("");
	const optionId = (index: number) => `${listId}-${index}`;

	const listRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (mark < 0) return;
		listRef.current
			?.querySelector(`[data-index="${mark}"]`)
			?.scrollIntoView?.({ block: "nearest" });
	}, [mark]);

	const run = (item: CommandPaletteItem | undefined) => {
		if (!item) return;
		if (item.unavailable === undefined) onRun(item.id);
		else setRefused(item.unavailable);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.nativeEvent.isComposing) return;
		const count = matches.length;
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			if (count === 0) return;
			const step = event.key === "ArrowDown" ? 1 : -1;
			setMark((current) => (current + step + count) % count);
		} else if (event.key === "Enter") {
			event.preventDefault();
			run(marked);
		}
	};

	return (
		<div data-slot="command-palette" className="flex min-h-0 flex-col">
			<TextField
				aria-label={text.search}
				autoFocus
				value={query}
				onChange={(value) => {
					setQuery(value);
					setRefused("");
				}}
				className="shrink-0"
			>
				<Input
					role="combobox"
					aria-expanded="true"
					aria-controls={listId}
					aria-autocomplete="list"
					aria-activedescendant={marked ? optionId(mark) : undefined}
					autoComplete="off"
					spellCheck={false}
					placeholder={text.placeholder}
					onKeyDown={onKeyDown}
					// As Input marks focus: the edge in the text colour while focused, the focus ring (inset, inside the
					// surface's edge) when focus came by keyboard.
					className={({ isFocused }) =>
						cn(
							"h-control-xl w-full rounded-t-dialog border-b bg-transparent px-4 text-ui-lg text-text outline-none placeholder:text-text-muted",
							"focus-ring-inset",
							motion,
							isFocused ? "border-text" : "border-border-default",
						)
					}
				/>
			</TextField>
			<div
				ref={listRef}
				id={listId}
				role="listbox"
				aria-label={text.commands}
				className={cn(
					"flex max-h-96 flex-col overflow-y-auto p-popover",
					matches.length === 0 && "hidden",
				)}
			>
				{matches.map((item, index) => {
					const describedBy =
						item.unavailable !== undefined || item.shortcut
							? `${optionId(index)}-note`
							: undefined;
					return (
						// biome-ignore lint/a11y/useFocusableInteractive: an option of the input's list (aria-activedescendant); focus stays in the input.
						// biome-ignore lint/a11y/useKeyWithClickEvents: the keyboard acts through the input (ArrowUp, ArrowDown, Enter), which owns this list.
						<div
							key={item.id}
							id={optionId(index)}
							role="option"
							aria-selected={index === mark}
							aria-disabled={item.unavailable !== undefined || undefined}
							aria-labelledby={`${optionId(index)}-title`}
							aria-describedby={describedBy}
							data-key={item.id}
							data-index={index}
							data-focused={index === mark || undefined}
							data-unavailable={item.unavailable === undefined ? undefined : ""}
							onPointerMove={() => {
								if (index !== mark) setMark(index);
							}}
							onClick={() => run(item)}
							className={cn(
								"relative flex min-h-row w-full shrink-0 cursor-default items-center gap-4 rounded-control px-edge",
								"text-ui text-text select-none",
								"data-focused:bg-fill-hover data-focused:outline-2 data-focused:-outline-offset-2 data-focused:outline-solid data-focused:outline-focus-ring",
							)}
						>
							<span
								id={`${optionId(index)}-title`}
								className="min-w-0 flex-1 truncate"
							>
								{item.title}
							</span>
							{item.unavailable !== undefined ? (
								<span
									id={describedBy}
									className="shrink-0 text-ui-sm text-text"
								>
									{item.unavailable}
								</span>
							) : item.shortcut ? (
								<kbd
									id={describedBy}
									aria-keyshortcuts={item.shortcut.aria}
									className="shrink-0 font-mono text-ui-sm text-text"
								>
									{item.shortcut.label}
								</kbd>
							) : null}
						</div>
					);
				})}
			</div>
			{matches.length === 0 ? (
				<div className="p-popover">
					<p className="flex min-h-row items-center px-edge text-ui text-text">
						{text.noMatches}
					</p>
				</div>
			) : null}
			<span role="status" className="sr-only">
				{refused}
			</span>
		</div>
	);
}
