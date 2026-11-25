// Must pass tools/check-palette: hashes that are not colours. Issue #950 in a comment, colour #fff in prose.
export const root = document.querySelector("#root");
export const route = "#/settings";
export const Anchor = () => (
	<a href="#add" id="fade">
		jump
	</a>
);
export const swatch = { backgroundColor: "var(--role-surface)" };
export const toRgb = (value: string) => value;
