// @ak-studio/ui: the Studio's design system. Tokens are in theme.css (imported by the consumer's stylesheet).
// The components below are the base set proposed for the P1a design gate (Task 9): the ones P2 and P3 use
// (controls, display, overlays and structure; Drawer is left to P6). The "Base component set" sign-off is
// pending. Exports are in path order (Biome sorts them).
export const name = "@ak-studio/ui";

export { Badge, type BadgeProps } from "./components/badge";

export {
	Button,
	type ButtonProps,
	IconButton,
	type IconButtonProps,
} from "./components/button";
export {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
	type CardTitleProps,
} from "./components/card";
export { Checkbox, type CheckboxProps } from "./components/checkbox";
export { CodeBlock, type CodeBlockProps } from "./components/code-block";
export {
	Combobox,
	ComboboxItem,
	type ComboboxItemProps,
	type ComboboxProps,
} from "./components/combobox";
export {
	DataTable,
	DataTableBody,
	DataTableCell,
	type DataTableCellProps,
	DataTableColumn,
	type DataTableColumnProps,
	DataTableHeader,
	type DataTableProps,
	DataTableRow,
	type TableDensity,
} from "./components/data-table";
export { EmptyState, type EmptyStateProps } from "./components/empty-state";
export {
	type BannerTone,
	InlineBanner,
	type InlineBannerProps,
} from "./components/inline-banner";
export { Input, type InputProps } from "./components/input";
export { PathChip, type PathChipProps } from "./components/path-chip";
export {
	type PanelLayout,
	ResizableHandle,
	type ResizableHandleProps,
	ResizablePanel,
	type ResizablePanelProps,
	ResizablePanels,
	type ResizablePanelsProps,
} from "./components/resizable-panels";
export {
	SegmentedControl,
	SegmentedControlItem,
	type SegmentedControlItemProps,
	type SegmentedControlProps,
} from "./components/segmented-control";
export {
	Select,
	SelectItem,
	type SelectItemProps,
	type SelectProps,
} from "./components/select";
export { Skeleton } from "./components/skeleton";
export { Spinner, type SpinnerProps } from "./components/spinner";
export {
	type Status,
	StatusChip,
	type StatusChipProps,
} from "./components/status-chip";
export { Switch, type SwitchProps } from "./components/switch";
export {
	Tab,
	TabList,
	type TabListProps,
	TabPanel,
	type TabPanelProps,
	type TabProps,
	Tabs,
	type TabsProps,
} from "./components/tabs";
export { Tag, type TagProps } from "./components/tag";
export { Textarea, type TextareaProps } from "./components/textarea";
export { Tooltip, type TooltipProps } from "./components/tooltip";
export {
	Tree,
	TreeItem,
	type TreeItemProps,
	type TreeMarker,
	type TreeProps,
} from "./components/tree";
export { cn } from "./lib/utils";
export type { CodeBlockStrings, PathChipStrings } from "./strings";
export { uiStrings } from "./strings";
