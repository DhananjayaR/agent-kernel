// VersionNotice: a feature the project's OAK version lacks (the version gate; P1b design gate row (d) and P2 row
// (c), both signed off 26 November 2026). Never hides the feature and never shows a bare disabled control: it says
// the version that adds the feature and the upgrade command to copy. The Studio shows the command and never runs it.
// Presentational: the renderer's CapabilityGate fills it from the capability catalog (useCapability), the project's
// version and P2's upgrade command.
//
// Three sizes, one set of words:
// - **tab**: the tab stays in the tab list; its content is the EmptyState frame: "{Feature} needs OAK {since} or
//   later", "This project uses OAK {version}. Upgrade OAK in this project to use it.", the upgrade command in a
//   CodeBlock with Copy, and "Open the docs".
// - **section**: the section stays in the section list with a "Needs {since}" tag in text (VersionTag; not dimming,
//   which Config uses for "not set"). Opened, the form shows this banner (info) with the version and the command over
//   its fields, which the gate renders read-only.
// - **control** (P2's palette-tile rule, the precedent for one control): the control keeps its place, showing its
//   own label and the "Needs {since}" tag; pressing it (or Enter) opens a popover with the same words, the command
//   and the docs link. It does nothing else: it does not run, drag or toggle.
//
// "Removed" uses the same frames: "{Feature} was removed in OAK {until}", the project's version, and what replaces it
// ("Use {replacement} instead.") when the catalog names one; there is no upgrade command for it. Without a command
// (none known yet: P2 builds it from the project's own dependency line) the words still say to upgrade; without a
// docs opener, "Open the docs" is left out.
import { IconCircleArrowUp } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { fillString, uiStrings, type VersionNoticeStrings } from "../strings";
import { Button } from "./button";
import { CodeBlock } from "./code-block";
import { EmptyState } from "./empty-state";
import { InlineBanner } from "./inline-banner";
import { Popover } from "./popover";
import { Tag } from "./tag";

/** What the catalog says about a capability the project lacks. */
export type VersionGap =
	| {
			status: "needs-upgrade";
			/** The first OAK version with it. */
			since: string;
			until?: undefined;
			replacedBy?: undefined;
	  }
	| {
			status: "removed";
			since?: undefined;
			/** The first OAK version without it, when known. */
			until?: string;
			/** The title of what replaces it, when the catalog names one. */
			replacedBy?: string;
	  };

type Common = VersionGap & {
	/** The capability's title ("Azure Functions deploy"). */
	feature: string;
	/** The project's OAK version, when known. */
	version?: string;
	/** The upgrade command to copy (P2: from the project's own dependency line, with the new lower bound). */
	upgradeCommand?: string;
	/** Copies the command (a callback: this package makes no clipboard call); Copy shows only when given. */
	onCopyCommand?: (command: string) => Promise<unknown> | undefined;
	/** Opens the capability's docs page; "Open the docs" shows only when given. */
	onOpenDocs?: () => void;
	strings?: Partial<VersionNoticeStrings>;
	className?: string;
};

export type VersionNoticeProps = Common &
	(
		| { size: "tab"; headingLevel?: 2 | 3 | 4; label?: undefined }
		| { size: "section"; headingLevel?: undefined; label?: undefined }
		| {
				size: "control";
				/** What the control says (a palette tile's name); it keeps its place with the tag beside it. */
				label: ReactNode;
				headingLevel?: undefined;
		  }
	);

/** The notice's words: title, then what the project has and what to do. */
function words(props: Common, text: VersionNoticeStrings, readOnly: boolean) {
	const { feature, version } = props;
	const title =
		props.status === "needs-upgrade"
			? fillString(text.needsUpgrade, { feature, since: props.since })
			: props.until
				? fillString(text.removed, { feature, until: props.until })
				: fillString(text.removedUnknown, { feature });
	const parts = [
		version ? fillString(text.projectVersion, { version }) : undefined,
		props.status === "needs-upgrade" ? text.upgrade : undefined,
		props.status === "needs-upgrade" && readOnly ? text.readOnly : undefined,
		props.status === "removed"
			? props.replacedBy
				? fillString(text.replacedBy, { replacement: props.replacedBy })
				: text.removedNext
			: undefined,
		props.status === "removed" && readOnly ? text.readOnlyRemoved : undefined,
	].filter((part): part is string => part !== undefined);
	return { title, description: parts.join(" ") };
}

/** The "Needs {since}" (or "Removed in {until}") tag, in text: for a gated section in its list, or a control. */
export function VersionTag({
	strings,
	className,
	...gap
}: VersionGap & {
	strings?: Partial<VersionNoticeStrings>;
	className?: string;
}) {
	const text = { ...uiStrings.versionNotice, ...strings };
	const label =
		gap.status === "needs-upgrade"
			? fillString(text.tag, { since: gap.since })
			: gap.until
				? fillString(text.tagRemoved, { until: gap.until })
				: text.tagRemovedUnknown;
	return (
		<Tag data-slot="version-tag" className={className}>
			{label}
		</Tag>
	);
}

/** The command to copy and the docs link: shown under the words in every size. */
function Upgrade({
	props,
	text,
	inPopover = false,
}: {
	props: Common & { size?: VersionNoticeProps["size"] };
	text: VersionNoticeStrings;
	/** In the popover the quiet button keeps its padding inside the popover's edge. */
	inPopover?: boolean;
}) {
	const command =
		props.status === "needs-upgrade" ? props.upgradeCommand : undefined;
	if (!command && !props.onOpenDocs) return null;
	// The docs link alone (no command) in the tab's centred frame is centred with the words.
	const alone = !command && !inPopover && props.size === "tab";
	return (
		<div
			className={cn(
				"flex w-full flex-col gap-2",
				alone ? "items-center text-center" : "items-start text-start",
			)}
		>
			{command ? (
				<>
					<CodeBlock
						code={command}
						label={text.command}
						onCopy={props.onCopyCommand}
						className="w-full"
					/>
					<p className="text-ui-sm text-text-muted">{text.commandHint}</p>
				</>
			) : null}
			{props.onOpenDocs ? (
				<Button
					variant="ghost"
					className={inPopover || alone ? undefined : "-ms-3"}
					onPress={props.onOpenDocs}
				>
					{text.docs}
				</Button>
			) : null}
		</div>
	);
}

export function VersionNotice(props: VersionNoticeProps) {
	const text = { ...uiStrings.versionNotice, ...props.strings };
	const { title, description } = words(props, text, props.size === "section");

	if (props.size === "tab") {
		return (
			<div data-slot="version-notice" className={props.className}>
				<EmptyState
					title={title}
					description={description}
					icon={<IconCircleArrowUp aria-hidden="true" />}
					headingLevel={props.headingLevel}
				>
					<Upgrade props={props} text={text} />
				</EmptyState>
			</div>
		);
	}

	if (props.size === "section") {
		return (
			<InlineBanner
				data-slot="version-notice"
				tone="info"
				title={title}
				className={props.className}
			>
				<div className="flex flex-col gap-3">
					<p>{description}</p>
					<Upgrade props={props} text={text} />
				</div>
			</InlineBanner>
		);
	}

	return (
		<Popover
			title={title}
			placement="bottom start"
			trigger={
				<Button
					data-slot="version-notice"
					variant="outline"
					className={cn("max-w-full", props.className)}
				>
					<span className="truncate">{props.label}</span>
					<VersionTag
						{...(props.status === "needs-upgrade"
							? { status: "needs-upgrade", since: props.since }
							: { status: "removed", until: props.until })}
						strings={props.strings}
					/>
				</Button>
			}
		>
			<p className="text-ui text-text">{description}</p>
			<Upgrade props={props} text={text} inPopover />
		</Popover>
	);
}
