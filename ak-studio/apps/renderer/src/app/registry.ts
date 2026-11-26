// The app registry: everything the shell and the router need from the feature manifests (features.ts), built once.
// The tabs (by their `order`), the routes, the command list (handed to runCommand, shared/commands/runCommand.ts,
// so any feature can run any command without importing it), the capabilities the manifests name, and the shortcut
// map per platform, and which feature owns each job kind and which command shows it (the background job notice).
// The shell and the router import this module, never a feature. A manifest list it cannot accept (two features with
// one id, two commands with one id, a command outside its feature's namespace, two routes at one path, two owners
// of one job kind) throws as the app loads.
import type { AppCommand } from "../shared/commands/command";
import type { FeatureManifest, FeatureRoute } from "../shared/commands/feature";
import { setCommands } from "../shared/commands/runCommand";
import {
	buildShortcutMap,
	type ShortcutPlatform,
} from "../shared/commands/shortcuts";
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
	/** The command with `id`; throws if no manifest declares it (a renamed id fails at once, not silently). */
	command(id: string): AppCommand;
	/** Every capability a manifest or one of its commands names, once each. */
	capabilities: readonly string[];
	/** The feature that owns the job kind `kind` (its manifest's `jobs`), if any. */
	ownerOfJob(kind: string): string | undefined;
	/** The command that brings feature `featureId` on screen (its manifest's `show`), if it declares one. */
	showCommand(featureId: string): string | undefined;
	/** Each resolved shortcut on `platform` ("Control+J") and its command: what the app's keydown listener looks up. */
	shortcutMap(platform: ShortcutPlatform): ReadonlyMap<string, AppCommand>;
}

/**
 * Builds the registry from `manifests`; throws for repeated feature ids, command ids or route paths, and for a
 * command whose id does not start with its feature's id and a dot (the palette's prefix and namespace ownership
 * rest on it).
 */
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
	const jobOwners = new Map<string, string>();
	const shows = new Map<string, string>();
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
			if (!command.id.startsWith(`${manifest.id}.`))
				throw new Error(
					`command ${command.id} is declared by feature ${manifest.id}: its id must start with "${manifest.id}."`,
				);
			if (commandIds.has(command.id))
				throw new Error(`command ${command.id} is declared twice`);
			commandIds.add(command.id);
			commands.push(command);
			if (command.capability !== undefined)
				capabilities.add(command.capability);
		}
		for (const capability of manifest.capabilities)
			capabilities.add(capability);
		for (const kind of manifest.jobs ?? []) {
			const owner = jobOwners.get(kind);
			if (owner !== undefined)
				throw new Error(
					`features ${owner} and ${manifest.id} both own job kind ${kind}`,
				);
			jobOwners.set(kind, manifest.id);
		}
		if (manifest.show !== undefined) shows.set(manifest.id, manifest.show);
	}
	tabs.sort((a, b) => a.order - b.order);
	const defaultTab = tabs[0];
	if (!defaultTab) throw new Error("no feature has a tab");
	return {
		tabs,
		defaultTab,
		routes,
		commands,
		command: (id) => {
			const found = commands.find((command) => command.id === id);
			if (!found) throw new Error(`no feature declares command ${id}`);
			return found;
		},
		capabilities: [...capabilities],
		ownerOfJob: (kind) => jobOwners.get(kind),
		showCommand: (featureId) => shows.get(featureId),
		shortcutMap: (platform) => buildShortcutMap(commands, platform),
	};
}

/** The app's registry, from features.ts. Its commands are what runCommand runs. */
export const registry: AppRegistry = buildRegistry(features);
setCommands(registry.commands);
