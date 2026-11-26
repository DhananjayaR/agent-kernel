// The one list of feature manifests (architecture.md, Features): the app registry (registry.ts) builds the shell's
// tabs, the router's routes, the command list and the shortcut map from it. Adding a feature adds one line here and
// never edits the shell. The shell's own commands come first, as a manifest with no tab.

import { aboutFeature } from "../features/about/manifest";
import { canvasFeature } from "../features/canvas/manifest";
import { codeFeature } from "../features/code/manifest";
import { configFeature } from "../features/config/manifest";
import { deployFeature } from "../features/deploy/manifest";
import { testTraceFeature } from "../features/test-trace/manifest";
import type { FeatureManifest } from "../shared/commands/feature";
import { shellFeature } from "./shell/manifest";

export const features: readonly FeatureManifest[] = [
	shellFeature,
	canvasFeature,
	codeFeature,
	configFeature,
	testTraceFeature,
	deployFeature,
	aboutFeature,
];
