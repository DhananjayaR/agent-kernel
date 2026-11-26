// The token reference page may paint colours from their variables (inline colour styles allowed), but an arbitrary
// value still fails here.
export const Swatch = () => (
	<div
		className="h-[37px]"
		style={{
			backgroundColor: "var(--role-surface)",
		}}
	/>
);
