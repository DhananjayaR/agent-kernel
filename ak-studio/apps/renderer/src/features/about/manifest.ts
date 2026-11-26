// The About feature's manifest: how it joins the app (architecture.md, Features). The route its screen is mounted
// at, its app commands and the kernel capabilities it uses. The only file app/ imports (app/features.ts).
// `about.runDemoJob` starts the demo job from the command palette; it has no shortcut.
import { defineCommand } from "../../shared/commands/command";
import { defineFeature } from "../../shared/commands/feature";
import { startJob } from "../../shared/jobs/jobStore";
import { AboutScreen } from "./screens/AboutScreen";
import { aboutStrings } from "./strings";

export const aboutFeature = defineFeature({
	id: "about",
	routes: [{ path: "/about", component: AboutScreen }],
	commands: [
		defineCommand({
			id: "about.runDemoJob",
			title: aboutStrings.commands.runDemoJob,
			run: async () => {
				await startJob("about.demoJob", {});
			},
		}),
	],
	capabilities: [],
});
