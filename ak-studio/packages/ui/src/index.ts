// @ak-studio/ui: the Studio's design system. Tokens are in theme.css (imported by the consumer's stylesheet).
// The components below are the base set proposed for the P1a design gate (Task 9): the ones P2 and P3 use
// (controls, display, overlays and structure; Drawer is left to P6), and the desktop shell (Task 10: DesktopShell,
// TopBar, AppTabList, ProjectSwitcher, the top bar controls, BottomPanel, StatusBar, SettingsModal), and the P1b
// patterns (Task 15: ApprovalCard, JobProgressView, the background job notice; Task 16: SessionControlView,
// StreamingListView, CommandRow, CommandPaletteView; Task 17: StateMessage, ChangedOnDiskBanner, UnsavedChangesDialog,
// VersionNotice). The "Base component set" and "Shell layout" sign-offs are pending. Exports are in path order
// (Biome sorts them).
export const name = "@ak-studio/ui";

export {
	ApprovalCard,
	type ApprovalCardProps,
	ApprovalDetails,
	type ApprovalDetailsProps,
	type ApprovalError,
	ApprovalNameField,
	type ApprovalNameFieldProps,
	nameMatches,
} from "./components/approval";
export {
	type BackgroundJobEvent,
	type BackgroundJobNoticeInput,
	backgroundJobNotice,
	JobTabIcon,
	type JobTabIconProps,
} from "./components/background-job-notice";
export { Badge, type BadgeProps } from "./components/badge";
export {
	BOTTOM_PANEL_TABS,
	BottomPanel,
	type BottomPanelProps,
	type BottomPanelTabId,
} from "./components/bottom-panel";

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
export {
	ChangedOnDiskBanner,
	type ChangedOnDiskBannerProps,
} from "./components/changed-on-disk-banner";
export { Checkbox, type CheckboxProps } from "./components/checkbox";
export { CodeBlock, type CodeBlockProps } from "./components/code-block";
export {
	Combobox,
	ComboboxItem,
	type ComboboxItemProps,
	type ComboboxProps,
} from "./components/combobox";
export {
	type CommandPaletteItem,
	CommandPaletteView,
	type CommandPaletteViewProps,
} from "./components/command-palette";
export {
	CommandRow,
	type CommandRowProps,
	type CommandRowState,
	formatDuration,
	quoteArg,
} from "./components/command-row";
export {
	ConfirmModal,
	type ConfirmModalProps,
} from "./components/confirm-modal";
export {
	ContextMenu,
	type ContextMenuProps,
} from "./components/context-menu";
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
export {
	APP_TABS,
	type AppTabId,
	AppTabList,
	type AppTabListProps,
	BOTTOM_PANEL_COLLAPSED_HEIGHT,
	BOTTOM_PANEL_MAX_HEIGHT,
	BOTTOM_PANEL_MIN_HEIGHT,
	type BottomPanelLayout,
	DesktopShell,
	type DesktopShellProps,
	type DesktopShellTab,
	isAppTabId,
	MAIN_MIN_HEIGHT,
	TOP_BAR_COMPACT_BELOW,
	TopBar,
	type TopBarProps,
	useTopBarCompact,
} from "./components/desktop-shell";
export { EmptyState, type EmptyStateProps } from "./components/empty-state";
export {
	type BannerTone,
	InlineBanner,
	type InlineBannerProps,
} from "./components/inline-banner";
export { Input, type InputProps } from "./components/input";
export {
	ELAPSED_SHOWN_FROM_MS,
	formatElapsed,
	type JobProgressError,
	JobProgressStack,
	type JobProgressStackProps,
	type JobProgressState,
	JobProgressView,
	type JobProgressViewProps,
} from "./components/job-progress";
export {
	Menu,
	MenuItem,
	type MenuItemProps,
	type MenuProps,
	MenuSection,
	MenuSeparator,
} from "./components/menu";
export {
	isModalOpen,
	MODAL_OPEN_SELECTOR,
	Modal,
	ModalLayer,
	type ModalLayerProps,
	type ModalOpening,
	type ModalProps,
} from "./components/modal";
export { PathChip, type PathChipProps } from "./components/path-chip";
export { Popover, type PopoverProps } from "./components/popover";
export {
	type ProjectRef,
	ProjectSwitcher,
	type ProjectSwitcherProps,
} from "./components/project-switcher";
export {
	type PanelLayout,
	ResizableHandle,
	type ResizableHandleProps,
	ResizablePanel,
	type ResizablePanelHandle,
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
export {
	type SessionControlState,
	SessionControlView,
	type SessionControlViewProps,
	type SessionFact,
} from "./components/session-control";
export {
	SettingsModal,
	type SettingsModalProps,
	type ThemeChoice,
} from "./components/settings-modal";
export { Skeleton } from "./components/skeleton";
export { Spinner, type SpinnerProps } from "./components/spinner";
export {
	ErrorBanner,
	type ErrorSlots,
	type StateAction,
	StateMessage,
	type StateMessageKind,
	type StateMessageProps,
} from "./components/state-message";
export {
	StatusBar,
	type StatusBarProps,
	type StatusBarState,
} from "./components/status-bar";
export {
	type Status,
	StatusChip,
	type StatusChipProps,
} from "./components/status-chip";
export {
	STREAM_ROW_HEIGHT,
	StreamingListView,
	type StreamingListViewProps,
	type StreamLine,
} from "./components/streaming-list";
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
export {
	type BackgroundResult,
	createToastQueue,
	notifyBackgroundResult,
	TOAST_TIMEOUT_MS,
	type ToastQueue,
	ToastRegion,
	type ToastRegionProps,
	type ToastTone,
} from "./components/toast";
export { Tooltip, type TooltipProps } from "./components/tooltip";
export {
	BuildWithAIButton,
	type BuildWithAIButtonProps,
	type DeployState,
	DeployStatus,
	type DeployStatusProps,
	RunControl,
	type RunControlProps,
	type RunState,
	SettingsButton,
	type SettingsButtonProps,
} from "./components/top-bar-controls";
export {
	Tree,
	TreeItem,
	type TreeItemProps,
	type TreeMarker,
	type TreeProps,
} from "./components/tree";
export {
	UnsavedChangesDialog,
	type UnsavedChangesDialogProps,
} from "./components/unsaved-changes-dialog";
export {
	type VersionGap,
	VersionNotice,
	type VersionNoticeProps,
	VersionTag,
} from "./components/version-notice";
export {
	WindowControls,
	type WindowControlsProps,
} from "./components/window-controls";
export {
	ANSI_TONE_CLASS,
	type AnsiSegment,
	type AnsiTone,
	parseAnsiLine,
	stripAnsi,
} from "./lib/ansi";
export { cn } from "./lib/utils";
export type {
	ApprovalStrings,
	BackgroundJobStrings,
	BottomPanelStrings,
	ChangedOnDiskStrings,
	CodeBlockStrings,
	CommandPaletteStrings,
	CommandRowStrings,
	ConfirmModalStrings,
	DeployStatusStrings,
	JobProgressStrings,
	ModalStrings,
	PathChipStrings,
	ProjectSwitcherStrings,
	RunControlStrings,
	SessionControlStrings,
	SettingsStrings,
	ShellStrings,
	StateMessageStrings,
	StatusBarStrings,
	StreamingListStrings,
	ToastStrings,
	UnsavedChangesStrings,
	VersionNoticeStrings,
	WindowControlsStrings,
} from "./strings";
export { fillString, uiStrings } from "./strings";
