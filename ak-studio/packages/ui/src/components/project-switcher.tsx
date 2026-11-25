// ProjectSwitcher: the open project at the start of the top bar, and the way to another one. A quiet button with
// the folder name (cut with an ellipsis when the top bar is short of room; the path shows in its tooltip) that
// opens a menu: open folder, new project, recent projects, reveal in the file manager. With no project open it is
// a plain label, "No project open", not a control: there is nothing to switch from (in P1a no project can be
// opened yet; from P2 the Welcome screen stands in for an empty shell).
//
// Keyboard: the Menu's (Enter, Space or ArrowDown opens it; arrows move; Escape closes and returns focus).
import {
	ChevronDownIcon,
	FolderIcon,
	FolderOpenIcon,
	FolderPlusIcon,
	FolderSearchIcon,
} from "lucide-react";
import { cn } from "../lib/utils";
import { type ProjectSwitcherStrings, uiStrings } from "../strings";
import { Button } from "./button";
import { Menu, MenuItem, MenuSection, MenuSeparator } from "./menu";
import { Tooltip } from "./tooltip";

export type ProjectRef = {
	/** The folder name ("support-triage"). */
	name: string;
	/** Where it is, as the person reads it ("~/code/support-triage"). */
	path: string;
};

export type ProjectSwitcherProps = {
	/** The open project; omitted, the switcher says no project is open. */
	project?: ProjectRef;
	/** Recently opened projects, newest first (the open one left out). */
	recent?: readonly ProjectRef[];
	onOpenFolder?: () => void;
	onNewProject?: () => void;
	onOpenRecent?: (project: ProjectRef) => void;
	onReveal?: () => void;
	/** Overrides of the default copy (strings.ts). */
	strings?: Partial<ProjectSwitcherStrings>;
	className?: string;
};

export function ProjectSwitcher({
	project,
	recent = [],
	onOpenFolder,
	onNewProject,
	onOpenRecent,
	onReveal,
	strings,
	className,
}: ProjectSwitcherProps) {
	const text = { ...uiStrings.projectSwitcher, ...strings };
	if (!project) {
		return (
			<span
				data-slot="project-switcher"
				className={cn(
					"flex min-w-0 items-center gap-text-to-visual px-edge text-ui text-text-muted",
					className,
				)}
			>
				<FolderIcon aria-hidden="true" className="size-4 shrink-0" />
				<span className="truncate">{text.noProject}</span>
			</span>
		);
	}
	const run = (key: unknown) => {
		if (key === "open-folder") onOpenFolder?.();
		else if (key === "new-project") onNewProject?.();
		else if (key === "reveal") onReveal?.();
		else {
			const target = recent.find((r) => `recent:${r.path}` === key);
			if (target) onOpenRecent?.(target);
		}
	};
	return (
		<Menu
			aria-label={project.name}
			onAction={run}
			trigger={
				<Tooltip content={project.path} placement="bottom">
					<Button
						data-slot="project-switcher"
						variant="ghost"
						icon={<FolderIcon aria-hidden="true" />}
						className={cn("max-w-full min-w-0 shrink", className)}
					>
						<span className="min-w-0 truncate">{project.name}</span>
						<ChevronDownIcon aria-hidden="true" />
					</Button>
				</Tooltip>
			}
		>
			<MenuItem id="open-folder" icon={<FolderOpenIcon />}>
				{text.openFolder}
			</MenuItem>
			<MenuItem id="new-project" icon={<FolderPlusIcon />}>
				{text.newProject}
			</MenuItem>
			{recent.length > 0 ? (
				<>
					<MenuSeparator />
					<MenuSection title={text.recent}>
						{recent.map((r) => (
							<MenuItem
								key={r.path}
								id={`recent:${r.path}`}
								icon={<FolderIcon />}
							>
								{r.name}
							</MenuItem>
						))}
					</MenuSection>
				</>
			) : null}
			<MenuSeparator />
			<MenuItem id="reveal" icon={<FolderSearchIcon />}>
				{text.reveal}
			</MenuItem>
		</Menu>
	);
}
