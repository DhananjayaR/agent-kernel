// Templates for `pnpm new:feature <name>`: the files of a feature folder (architecture.md, Features). Each takes
// the names from lib.mjs's `namesOf` and answers the file's text, already formatted as Biome formats it. The copy
// is the feature's own name and nothing else (copy rules: no placeholder copy ships).
import { comment } from "../lib.mjs";

export const manifest = (
	n,
) => `${comment(`The ${n.title} feature's manifest: how it joins the app (architecture.md, Features). Its title (the command palette's prefix), the route its screen is mounted at, its app commands and the kernel capabilities it uses. The only file app/ imports (app/features.ts).`)}
import { defineFeature } from "../../shared/commands/feature";
import { ${n.pascal}Screen } from "./screens/${n.pascal}Screen";
import { ${n.camel}Strings } from "./strings";

export const ${n.camel}Feature = defineFeature({
	id: "${n.kebab}",
	title: ${n.camel}Strings.title,
	routes: [{ path: "/${n.kebab}", component: ${n.pascal}Screen }],
	commands: [],
	capabilities: [],
});
`;

export const manifestTest = (
	n,
) => `${comment(`The ${n.title} feature's manifest: its id and route, and the screen that route mounts, titled from the feature's strings.`)}
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ${n.camel}Feature } from "./manifest";
import { ${n.camel}Strings } from "./strings";

describe("${n.camel}Feature", () => {
	it("mounts its screen at /${n.kebab}, titled with the feature's name", () => {
		expect(${n.camel}Feature.id).toBe("${n.kebab}");
		const route = ${n.camel}Feature.routes?.find(
			(r) => r.path === "/${n.kebab}",
		);
		if (!route) throw new Error("no route at /${n.kebab}");
		const Screen = route.component;
		render(<Screen />);
		expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
			${n.camel}Strings.title,
		);
	});
});
`;

export const strings = (
	n,
) => `${comment(`The ${n.title} feature's copy, in one place (copy rules: sentence case, OAK's words, one strings module per feature), so it is reviewed and later translated together.`)}
export const ${n.camel}Strings = {
	title: "${n.title}",
} as const;
`;

export const keys = (
	n,
) => `${comment(`The ${n.title} feature's query keys (architecture.md, "Where each kind of data lives", rule 4): every key its hooks use is built from this factory, so a \`domain.changed\` event for \`${n.kebab}\` refreshes them all.`)}
import { keys } from "../../../shared/query/keys";

export const ${n.camel}Keys = keys("${n.kebab}");
`;

export const store = (
	n,
) => `${comment(`The ${n.title} feature's store (architecture.md, "Where each kind of data lives"): its UI state, such as what is selected, and any working copy. Data from the main process stays in the query cache (api/), never here.`)}
import { create } from "zustand";

export interface ${n.pascal}State {
	/** The id of what is selected in the feature's screen, if anything. */
	selectedId: string | undefined;
	select(id: string | undefined): void;
}

export const use${n.pascal}Store = create<${n.pascal}State>()((set) => ({
	selectedId: undefined,
	select: (selectedId) => set({ selectedId }),
}));
`;

export const storeTest = (
	n,
) => `${comment(`The ${n.title} feature's store: it holds UI state only, here the selection.`)}
import { afterEach, describe, expect, it } from "vitest";
import { use${n.pascal}Store } from "./store";

afterEach(() => {
	use${n.pascal}Store.setState({ selectedId: undefined });
});

describe("use${n.pascal}Store", () => {
	it("selects an id and clears it", () => {
		use${n.pascal}Store.getState().select("first");
		expect(use${n.pascal}Store.getState().selectedId).toBe("first");
		use${n.pascal}Store.getState().select(undefined);
		expect(use${n.pascal}Store.getState().selectedId).toBeUndefined();
	});
});
`;

export const screen = (
	n,
) => `${comment(`The ${n.title} feature's screen, mounted at /${n.kebab} (manifest.ts). It shows the feature's title; what it shows next comes from the feature's hooks (api/) and components (components/), each state with a story.`)}
import { ${n.camel}Strings } from "../strings";

export function ${n.pascal}Screen() {
	return (
		<section className="flex h-full flex-col gap-4 p-8">
			<h2 className="font-heading text-ui-xl font-bold text-text">
				{${n.camel}Strings.title}
			</h2>
		</section>
	);
}
`;

export const screenStories = (
	n,
) => `${comment(`Storybook stories for the ${n.title} screen (indexed from the renderer, P1b-plan ruling 16), one per state. Type-free CSF, as the renderer does not depend on Storybook.`)}
import { ${n.pascal}Screen } from "./${n.pascal}Screen";

export default {
	title: "Screens/${n.title}",
	component: ${n.pascal}Screen,
};

/** The screen with the feature's title. */
export const Default = {};
`;
