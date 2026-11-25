// PathChip: a file or folder path. The one component for it: never plain text or a link. Written by hand
// (shadcn has no equivalent). 24 px pill in monospace with a decorative hairline; a long path is cut at the end
// and shown whole in its title. Reveal and copy are optional actions: this package makes no Electron or
// clipboard call, the feature passes callbacks. After a copy the button shows a check for a moment and a
// status message announces it.
import { CheckIcon, CopyIcon, FolderOpenIcon } from "lucide-react";
import {
	type HTMLAttributes,
	type ReactNode,
	useEffect,
	useState,
} from "react";
import { Button } from "react-aria-components";
import { motion } from "../lib/styles";
import { cn } from "../lib/utils";

/** How long the copied check stays, in milliseconds. */
const COPIED_MS = 1500;

export type PathChipProps = Omit<
	HTMLAttributes<HTMLSpanElement>,
	"children"
> & {
	/** The path as the user should read it: relative to the project where it can be. */
	path: string;
	/** Shows a "Reveal in file manager" button that calls this. */
	onReveal?: () => void;
	/** Shows a "Copy path" button that calls this with the path. */
	onCopy?: (path: string) => void;
};

function ChipAction({
	label,
	onPress,
	children,
}: {
	label: string;
	onPress: () => void;
	children: ReactNode;
}) {
	return (
		<Button
			aria-label={label}
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
	);
}

export function PathChip({
	path,
	onReveal,
	onCopy,
	className,
	...props
}: PathChipProps) {
	const [copied, setCopied] = useState(false);
	useEffect(() => {
		if (!copied) return;
		const timer = setTimeout(() => setCopied(false), COPIED_MS);
		return () => clearTimeout(timer);
	}, [copied]);
	const hasActions = Boolean(onReveal || onCopy);

	return (
		<span
			data-slot="path-chip"
			className={cn(
				"inline-flex h-control-s max-w-full min-w-0 items-center rounded-pill pl-2.5 font-mono text-ui-sm text-text",
				"ring-1 ring-border-default ring-inset",
				hasActions ? "pr-0" : "pr-2.5",
				className,
			)}
			{...props}
		>
			<span className="min-w-0 truncate" title={path}>
				{path}
			</span>
			{hasActions ? <span className="w-1 shrink-0" /> : null}
			{onReveal ? (
				<ChipAction label="Reveal in file manager" onPress={onReveal}>
					<FolderOpenIcon aria-hidden="true" />
				</ChipAction>
			) : null}
			{onCopy ? (
				<ChipAction
					label="Copy path"
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
					{copied ? "Path copied" : ""}
				</span>
			) : null}
		</span>
	);
}
