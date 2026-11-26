// The app registry: everything the shell and the router need from the feature manifests (features.ts), built once.
// The tabs (by their `order`), the routes, the command list (handed to runCommand, shared/commands/runCommand.ts,
// so any feature can run any command without importing it), the capabilities the manifests name, and the shortcut
// map per platform. The shell and the router import this module, never a feature. A manifest list it cannot accept
// (two features with one id, two commands with one id, two routes at one path) throws as the app loads.
import type { AppCommand } from "../shared/commands/command";
import type { FeatureManifest, FeatureRoute } from "../shared/commands/feature";
import { setCommands } from "../shared/commands/runCommand";
import type { ShortcutPlatform } from "../shared/commands/shortcuts";
import { buildShortcutMap } from "../shared/commands/useAppShortcuts";
import { features } from "./features";

/** A tab in the shell's top bar: its feature's id, label and route path. */
export interface AppTab {
	id: string;
	label: string;
	path: string;
	order: number;
}

/** A route the router mounts, with the feature it belongs to. */
export interface AppRoute extends FeatureRoute {
	featureId: string;
}

export interface AppRegistry {
	/** The tabs, by ascending `order`. */
	tabs: readonly AppTab[];
	/** The tab `#/` and unknown paths open: the first tab. */
	defaultTab: AppTab;
	routes: readonly AppRoute[];
	/** Every app command, in manifest order. */
	commands: readonly AppCommand[];
	/** Every capability a manifest or one of its commands names, once each. */
	capabilities: readonly string[];
	/** Each resolved shortcut on `platform` ("Control+J") and its command: what the app's keydown listener looks up. */
	shortcutMap(platform: ShortcutPlatform): ReadonlyMap<string, AppCommand>;
}

/** Builds the registry from `manifests`; throws for repeated feature ids, command ids or route paths. */
export function buildRegistry(
	manifests: readonly FeatureManifest[],
): AppRegistry {
	const featureIds = new Set<string>();
	const commandIds = new Set<string>();
	const paths = new Map<string, string>();
	const routes: AppRoute[] = [];
	const tabs: AppTab[] = [];
	const commands: AppCommand[] = [];
	const capabilities = new Set<string>();
	for (const manifest of manifests) {
		if (featureIds.has(manifest.id))
			throw new Error(`feature ${manifest.id} is listed twice`);
		featureIds.add(manifest.id);
		for (const route of manifest.routes ?? []) {
			const owner = paths.get(route.path);
			if (owner !== undefined)
				throw new Error(
					`features ${owner} and ${manifest.id} both have a route at ${route.path}`,
				);
			paths.set(route.path, manifest.id);
			routes.push({ ...route, featureId: manifest.id });
		}
		if (manifest.tab) tabs.push({ id: manifest.id, ...manifest.tab });
		for (const command of manifest.commands) {
			if (commandIds.has(command.id))
				throw new Error(`command ${command.id} is declared twice`);
			commandIds.add(command.id);
			commands.push(command);
			if (command.capability !== undefined)
				capabilities.add(command.capability);
		}
		for (const capability of manifest.capabilities)
			capabilities.add(capability);
	}
	tabs.sort((a, b) => a.order - b.order);
	const defaultTab = tabs[0];
	if (!defaultTab) throw new Error("no feature has a tab");
	return {
		tabs,
		defaultTab,
		routes,
		commands,
		capabilities: [...capabilities],
		shortcutMap: (platform) => buildShortcutMap(commands, platform),
	};
}

/** The app's registry, from features.ts. Its commands are what runCommand runs. */
export const registry: AppRegistry = buildRegistry(features);
setCommands(registry.commands);
