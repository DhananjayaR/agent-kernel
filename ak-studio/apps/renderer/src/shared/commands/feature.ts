// Feature manifests (architecture.md, Features): how a feature joins the app. A feature's manifest.ts declares its
// tab, its routes, its app commands and the kernel capabilities it uses; app/features.ts lists the manifests and
// app/registry.ts builds the shell's tabs, the router's routes, the command list and the shortcut map from them.
// Adding a feature never edits the shell. A manifest is checked when it is defined.
import type { ReactNode } from "react";
import type { AppCommand } from "./command";

/** A tab in the shell's top bar: its label (from the feature's strings), its route path and its place. */
export interface FeatureTab {
	label: string;
	/** The path of one of the feature's routes, which the tab shows: `/canvas`. */
	path: string;
	/** Tabs are shown by ascending order. */
	order: number;
}

/** A screen the router mounts at `path` (hash history: `#/canvas`). */
export interface FeatureRoute {
	path: string;
	component: () => ReactNode;
}

export interface FeatureManifest {
	/** The feature's folder name under features/ (kebab-case); its tab's id. */
	id: string;
	tab?: FeatureTab;
	routes?: readonly FeatureRoute[];
	commands: readonly AppCommand[];
	/** Every kernel capability (catalog id) the feature uses; a test checks each is in the catalog. */
	capabilities: readonly string[];
}

const FEATURE_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const ROUTE_PATH = /^\/[a-z0-9-]+(?:\/[a-z0-9-]+|\/\$[a-zA-Z]+)*$/;

/** Defines a feature's manifest; throws for an id, path or tab it cannot accept (a bug in the manifest). */
export function defineFeature(manifest: FeatureManifest): FeatureManifest {
	const fail = (why: string): never => {
		throw new Error(`feature ${manifest.id}: ${why}`);
	};
	if (!FEATURE_ID.test(manifest.id)) fail("its id is not kebab-case");
	const paths = (manifest.routes ?? []).map((route) => route.path);
	for (const path of paths)
		if (!ROUTE_PATH.test(path)) fail(`route path ${path} is not /kebab-case`);
	if (new Set(paths).size !== paths.length) fail("a route path is repeated");
	if (manifest.tab) {
		if (manifest.tab.label.trim() === "") fail("its tab has no label");
		if (!paths.includes(manifest.tab.path))
			fail(`its tab's path ${manifest.tab.path} is not one of its routes`);
	}
	return Object.freeze({ ...manifest });
}
