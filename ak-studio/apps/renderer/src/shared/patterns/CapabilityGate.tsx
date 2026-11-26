// CapabilityGate: the version gate over `useCapability` (architecture.md, OAK versions in the code; P1b design gate
// row (d) and P2 row (c), signed off 26 November 2026). It wraps any tab, form section or control that needs a
// capability; no feature writes its own version check, and nothing is hidden.
//
// - **available**: its children, as they are.
// - **needs-upgrade** or **removed**: the version notice at its size (VersionNotice): `tab`, the empty state frame
//   in place of the tab's content; `section`, the banner over the section's fields, which it renders read-only
//   (`children` gets `{ readOnly: true }`; read-only, not disabled or dimmed, so the values stay readable and
//   selectable); `control`, the control in its place with the "Needs {since}" tag, pressing it opens the popover.
//   CapabilityTag is the tag alone, for a gated section in its section list.
//
// The words come from the catalog entry (title, since, until, replacedBy, docs) and the project's version; the
// upgrade command and the docs opener from the CatalogProvider (P2's KernelService builds the command from the
// project's own dependency line, keeping its extras). The command is shown with Copy and never run; without one
// (all of P1b) the notice still says to upgrade. Copy goes to the clipboard, and a refusal is reported (a toast).
import { type VersionGap, VersionNotice, VersionTag } from "@ak-studio/ui";
import type { ReactNode } from "react";
import {
	type CapabilityNotice,
	useCapabilityNotice,
} from "../capability/capability";
import { copyToClipboard } from "./clipboard";
import { patternStrings } from "./strings";

export type CapabilityGateProps = { id: string } & (
	| { size: "tab"; children: ReactNode; headingLevel?: 2 | 3 | 4 }
	| {
			size: "section";
			/** The section's fields; `readOnly` is true while the project's version lacks the capability. */
			children: (gate: { readOnly: boolean }) => ReactNode;
	  }
	| {
			size: "control";
			/** What the control says, kept in its place with the tag when it is gated. */
			label: ReactNode;
			children: ReactNode;
	  }
);

/** The notice's gap, from the catalog entry: needs `since`, or removed in `until` (with its replacement). */
function gapOf(notice: CapabilityNotice): VersionGap {
	if (notice.status === "removed")
		return {
			status: "removed",
			...(notice.entry?.until === undefined
				? {}
				: { until: notice.entry.until }),
			...(notice.replacement === undefined
				? {}
				: { replacedBy: notice.replacement }),
		};
	return { status: "needs-upgrade", since: notice.entry?.since ?? "" };
}

const copyCommand = (command: string) =>
	copyToClipboard(command, patternStrings.copyCommandFailed);

export function CapabilityGate(props: CapabilityGateProps) {
	const notice = useCapabilityNotice(props.id);
	if (notice.status === "available") {
		return props.size === "section"
			? props.children({ readOnly: false })
			: props.children;
	}
	const common = {
		...gapOf(notice),
		feature: notice.entry?.title ?? props.id,
		...(notice.version === undefined ? {} : { version: notice.version }),
		...(notice.upgradeCommand === undefined
			? {}
			: { upgradeCommand: notice.upgradeCommand, onCopyCommand: copyCommand }),
		...(notice.openDocs === undefined ? {} : { onOpenDocs: notice.openDocs }),
	};
	if (props.size === "tab")
		return (
			<VersionNotice {...common} size="tab" headingLevel={props.headingLevel} />
		);
	if (props.size === "control")
		return <VersionNotice {...common} size="control" label={props.label} />;
	return (
		<div data-slot="capability-section" className="flex flex-col gap-4">
			<VersionNotice {...common} size="section" />
			{props.children({ readOnly: true })}
		</div>
	);
}

/** The "Needs {since}" tag for a gated section in its section list; nothing while the capability is available. */
export function CapabilityTag({ id }: { id: string }) {
	const notice = useCapabilityNotice(id);
	if (notice.status === "available") return null;
	return <VersionTag {...gapOf(notice)} />;
}
