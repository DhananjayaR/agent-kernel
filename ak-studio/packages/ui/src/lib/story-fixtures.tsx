// Story fixtures shared by several components' stories (not exported): a small project tree in the shape of the
// support-triage example.
import { IconFile, IconFolder } from "@tabler/icons-react";
import { Collection } from "react-aria-components";
import { TreeItem } from "../components/tree";

export type FileNode = {
	id: string;
	name: string;
	marker?: "changed" | "new";
	children?: FileNode[];
};

export const projectFiles: FileNode[] = [
	{
		id: "agents",
		name: "agents",
		children: [
			{ id: "agents/triage.py", name: "triage.py", marker: "changed" },
			{ id: "agents/billing.py", name: "billing.py" },
			{ id: "agents/escalation.py", name: "escalation.py", marker: "new" },
		],
	},
	{
		id: "tools",
		name: "tools",
		children: [{ id: "tools/tickets.py", name: "tickets.py" }],
	},
	{ id: "app.py", name: "app.py", marker: "changed" },
	{ id: "config.yaml", name: "config.yaml" },
	{ id: "pyproject.toml", name: "pyproject.toml" },
];

const MARKERS = {
	changed: { letter: "M", label: "Changed" },
	new: { letter: "N", label: "New" },
} as const;

/** Renders a FileNode and its children as TreeItems. */
export function FileTreeItem({ node }: { node: FileNode }) {
	const marker = node.marker ? MARKERS[node.marker] : null;
	return (
		<TreeItem
			id={node.id}
			title={node.name}
			icon={
				node.children ? (
					<IconFolder aria-hidden="true" />
				) : (
					<IconFile aria-hidden="true" />
				)
			}
			markers={marker ? [marker] : undefined}
		>
			{node.children ? (
				<Collection items={node.children}>
					{(child) => <FileTreeItem node={child} />}
				</Collection>
			) : null}
		</TreeItem>
	);
}
