// Must pass tools/check-palette: role tokens, the spacing scale, arbitrary variants, CSS selectors.
export const Allowed = () => (
	<div
		className="bg-surface text-text p-4 data-[state=open]:bg-surface-raised [&_tr]:px-cell has-[>svg]:gap-2 whitespace-nowrap"
		data-theme="dark"
	>
		allowed
	</div>
);
