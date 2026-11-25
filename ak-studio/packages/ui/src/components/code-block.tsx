// CodeBlock: a snippet the user reads or copies (the upgrade command a version gate suggests, a config
// excerpt). Not for a command the app ran: that is a CommandRow (P1b). Written by hand (shadcn has no code
// block): monospace on the raised surface, a caption row with an optional copy action (a callback: this
// package makes no clipboard call). The code scrolls sideways and is keyboard-focusable so it can be scrolled.
import { CheckIcon, CopyIcon } from "lucide-react";
import { type HTMLAttributes, useEffect, useState } from "react";
import { cn } from "../lib/utils";
import { IconButton } from "./button";

const COPIED_MS = 1500;

export type CodeBlockProps = Omit<
	HTMLAttributes<HTMLElement>,
	"children" | "onCopy"
> & {
	code: string;
	/** What the code is ("Upgrade command"); also names the scrollable region. */
	label: string;
	/** Shows a copy button that calls this with the code. */
	onCopy?: (code: string) => void;
};

export function CodeBlock({
	code,
	label,
	onCopy,
	className,
	...props
}: CodeBlockProps) {
	const [copied, setCopied] = useState(false);
	useEffect(() => {
		if (!copied) return;
		const timer = setTimeout(() => setCopied(false), COPIED_MS);
		return () => clearTimeout(timer);
	}, [copied]);

	return (
		<figure
			data-slot="code-block"
			className={cn(
				"flex min-w-0 flex-col rounded-control border border-border-default bg-surface-raised",
				className,
			)}
			{...props}
		>
			<figcaption className="flex min-h-control-m items-center justify-between gap-2 border-b border-border-default pr-1 pl-edge text-ui-sm text-text-muted">
				{label}
				{onCopy ? (
					<IconButton
						aria-label={`Copy ${label.toLowerCase()}`}
						icon={copied ? <CheckIcon /> : <CopyIcon />}
						onPress={() => {
							onCopy(code);
							setCopied(true);
						}}
					/>
				) : null}
			</figcaption>
			<pre
				// biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard (WCAG 2.1.1).
				tabIndex={0}
				className="overflow-x-auto rounded-b-control p-edge font-mono text-ui-sm text-text outline-none focus-visible:focus-outline"
			>
				<code>{code}</code>
			</pre>
			{onCopy ? (
				<span role="status" className="sr-only">
					{copied ? `${label} copied` : ""}
				</span>
			) : null}
		</figure>
	);
}
