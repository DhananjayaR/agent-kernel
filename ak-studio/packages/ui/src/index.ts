// @ak-studio/ui: the Studio's design system. Tokens are in theme.css (imported by the consumer's stylesheet);
// the components below are the base set approved at the P1a design gate (Task 9), the ones P2 and P3 use.
export const name = "@ak-studio/ui";

// Display
export { Badge, type BadgeProps } from "./components/badge";

// Controls
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
export { EmptyState, type EmptyStateProps } from "./components/empty-state";
export {
	type BannerTone,
	InlineBanner,
	type InlineBannerProps,
} from "./components/inline-banner";
export { Input, type InputProps } from "./components/input";
export { PathChip, type PathChipProps } from "./components/path-chip";
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
export { Tag, type TagProps } from "./components/tag";
export { Textarea, type TextareaProps } from "./components/textarea";
export { Tooltip, type TooltipProps } from "./components/tooltip";
export { cn } from "./lib/utils";
