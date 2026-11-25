// Tag: a static label for a category (an installed framework, an extra). Written by hand: shadcn's React Aria
// registry has no static tag (spike S1 restyled `badge` for it). 24 px, 8 px radius, 12 px text on the neutral
// fill (only `text`-coloured content sits on it). Not interactive; a removable tag would use React Aria
// `TagGroup` and is not needed by P2 or P3.
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/utils";

export type TagProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
	/** Leading icon (Tabler outline, `@tabler/icons-react`), decorative. */
	icon?: ReactNode;
	children: ReactNode;
};

export function Tag({ icon, className, children, ...props }: TagProps) {
	return (
		<span
			data-slot="tag"
			className={cn(
				"inline-flex h-control-s max-w-full shrink-0 items-center gap-1 rounded-control bg-fill px-2 text-ui-sm text-text whitespace-nowrap",
				"[&_svg]:size-4 [&_svg]:shrink-0",
				className,
			)}
			{...props}
		>
			{icon}
			<span className="truncate">{children}</span>
		</span>
	);
}
