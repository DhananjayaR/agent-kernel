// CodeBlock: a snippet the user reads or copies (the upgrade command a version gate suggests, a config
// excerpt). Not for a command the app ran: that is a CommandRow (P1b). Written by hand (shadcn has no code
// block): monospace on the raised surface, a caption row with an optional copy action (a callback: this
// package makes no clipboard call) with a tooltip. The code scrolls sideways; its scroll region is
// keyboard-focusable and named by the caption. Copy defaults: strings.ts.
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { type HTMLAttributes, useEffect, useId, useState } from "react";
import { cn } from "../lib/utils";
import { type CodeBlockStrings, uiStrings } from "../strings";
import { IconButton } from "./button";
import { Tooltip } from "./tooltip";

const COPIED_MS = 1500;

export type CodeBlockProps = Omit<
	HTMLAttributes<HTMLElement>,
	"children" | "onCopy"
> & {
	code: string;
	/** What the code is ("Upgrade command"): the caption, which also names the code's scroll region. */
	label: string;
	/**
	 * Shows a copy button that calls this with the code. A copy that answers a promise shows "copied" once it
	 * resolves, and nothing if it rejects (the caller reports the failure).
	 */
	onCopy?: (code: string) => Promise<unknown> | undefined;
	/** Overrides of the default copy (strings.ts). */
	strings?: Partial<CodeBlockStrings>;
};

export function CodeBlock({
	code,
	label,
	onCopy,
	strings,
	className,
	...props
}: CodeBlockProps) {
	const text = { ...uiStrings.codeBlock, ...strings };
	const captionId = useId();
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
			<figcaption
				id={captionId}
				className="flex min-h-control-m items-center justify-between gap-2 border-b border-border-default pr-1 pl-edge text-ui-sm text-text-muted"
			>
				{label}
				{onCopy ? (
					<Tooltip content={text.copy}>
						<IconButton
							aria-label={text.copy}
							aria-describedby={captionId}
							icon={
								copied ? (
									<IconCheck aria-hidden="true" />
								) : (
									<IconCopy aria-hidden="true" />
								)
							}
							onPress={() => {
								const done = onCopy(code);
								if (done instanceof Promise)
									done.then(
										() => setCopied(true),
										() => {},
									);
								else setCopied(true);
							}}
						/>
					</Tooltip>
				) : null}
			</figcaption>
			<section
				aria-labelledby={captionId}
				// biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard (WCAG 2.1.1).
				tabIndex={0}
				className="overflow-x-auto rounded-b-control outline-none focus-visible:focus-outline"
			>
				<pre className="p-edge font-mono text-ui-sm text-text">
					<code>{code}</code>
				</pre>
			</section>
			{onCopy ? (
				<span role="status" className="sr-only">
					{copied ? text.copied : ""}
				</span>
			) : null}
		</figure>
	);
}
