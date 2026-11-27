// Planted for tools/check-classes.test.mjs: eight arbitrary values (seven bracketed, among them three grid
// templates with underscores and named lines, and one variable shorthand).
export const Arbitrary = () => (
	<div className="p-[13px] bg-[#fff] w-[calc(100%-2rem)] [mask-type:luminance] gap-(--my-gap)">
		<dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-2">
			<dt className="md:grid-rows-[auto_1fr_auto]">planted</dt>
			<dd className="grid-cols-[[full-start]_minmax(0,1fr)_[full-end]]">planted</dd>
		</dl>
	</div>
);
