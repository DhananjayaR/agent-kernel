// PathChip: a file or folder path. The one component for it: never plain text or a link. Written by hand
// (shadcn has no equivalent). 24 px pill in monospace with a decorative hairline. A long path is cut in the
// middle: the folders shrink with an ellipsis and the last segment (the file name) stays whole. The full path is
// the chip's text for assistive technology and the description of each action. Reveal and copy are optional
// actions with tooltips; this package makes no Electron or clipboard call, the feature passes callbacks. After a
// copy the button shows a check for a moment and a status message announces it. Copy defaults: strings.ts.
import { CheckIcon, CopyIcon, FolderOpenIcon } from "lucide-react";
import {
	type HTMLAttributes,
	type ReactNode,
	useEffect,
	useId,
	useState,
} from "react";
import { Button } from "react-aria-components";
import { motion } from "../lib/styles";
import { cn } from "../lib/utils";
import { type PathChipStrings, uiStrings } from "../strings";
import { Tooltip } from "./tooltip";

/** How long the copied check stays, in milliseconds. */
const COPIED_MS = 1500;

export type PathChipProps = Omit<
	HTMLAttributes<HTMLSpanElement>,
	"children" | "onCopy"
> & {
	/** The path as the user should read it: relative to the project where it can be. */
	path: string;
	/** Shows a "Reveal in file manager" button that calls this. */
	onReveal?: () => void;
	/** Shows a "Copy path" button that calls this with the path. */
	onCopy?: (path: string) => void;
	/** Overrides of the default copy (strings.ts). */
	strings?: Partial<PathChipStrings>;
};

/** Splits a path into its folders (with the trailing separator) and its last segment. */
export function splitPath(path: string): { folders: string; name: string } {
	const trimmed = path.replace(/[\\/]+$/, "");
	const cut = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
	if (cut < 0) return { folders: "", name: path };
	return { folders: path.slice(0, cut + 1), name: path.slice(cut + 1) };
}

function ChipAction({
	label,
	describedBy,
	onPress,
	children,
}: {
	label: string;
	describedBy: string;
	onPress: () => void;
	children: ReactNode;
}) {
	return (
		<Tooltip content={label}>
			<Button
				aria-label={label}
				aria-describedby={describedBy}
				onPress={onPress}
				className={cn(
					"press focus-ring flex size-control-s shrink-0 cursor-default items-center justify-center rounded-pill text-text outline-none",
					motion,
					"data-hovered:bg-fill data-pressed:bg-fill-hover",
					"[&_svg]:size-3.5",
				)}
			>
				{children}
			</Button>
		</Tooltip>
	);
}

export function PathChip({
	path,
	onReveal,
	onCopy,
	strings,
	className,
	...props
}: PathChipProps) {
	const text = { ...uiStrings.pathChip, ...strings };
	const pathId = useId();
	const [copied, setCopied] = useState(false);
	useEffect(() => {
		if (!copied) return;
		const timer = setTimeout(() => setCopied(false), COPIED_MS);
		return () => clearTimeout(timer);
	}, [copied]);
	const hasActions = Boolean(onReveal || onCopy);
	const { folders, name } = splitPath(path);

	return (
		<span
			data-slot="path-chip"
			title={path}
			className={cn(
				"inline-flex h-control-s max-w-full min-w-0 items-center rounded-pill pl-2.5 font-mono text-ui-sm text-text",
				"ring-1 ring-border-default ring-inset",
				hasActions ? "pr-0" : "pr-2.5",
				className,
			)}
			{...props}
		>
			<span id={pathId} className="sr-only">
				{path}
			</span>
			<span aria-hidden="true" className="flex min-w-0 whitespace-pre">
				<span className="min-w-0 truncate">{folders}</span>
				<span className="shrink-0">{name}</span>
			</span>
			{hasActions ? <span className="w-1 shrink-0" /> : null}
			{onReveal ? (
				<ChipAction label={text.reveal} describedBy={pathId} onPress={onReveal}>
					<FolderOpenIcon aria-hidden="true" />
				</ChipAction>
			) : null}
			{onCopy ? (
				<ChipAction
					label={text.copy}
					describedBy={pathId}
					onPress={() => {
						onCopy(path);
						setCopied(true);
					}}
				>
					{copied ? (
						<CheckIcon aria-hidden="true" />
					) : (
						<CopyIcon aria-hidden="true" />
					)}
				</ChipAction>
			) : null}
			{onCopy ? (
				<span role="status" className="sr-only">
					{copied ? text.copied : ""}
				</span>
			) : null}
		</span>
	);
}
