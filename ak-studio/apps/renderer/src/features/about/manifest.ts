// The About feature's manifest: how it joins the app (architecture.md, Features). The route its screen is mounted
// at, its app commands and the kernel capabilities it uses. The only file app/ imports (app/features.ts).
// `about.runDemoJob` starts the demo job from the command palette; it has no shortcut. `about.show` opens the About
// screen: it is the manifest's `show`, which the background job notice's "Show" runs for an About job.
import { defineCommand } from "../../shared/commands/command";
import { defineFeature } from "../../shared/commands/feature";
import { canNavigate, navigateTo } from "../../shared/commands/navigation";
import { startJob } from "../../shared/jobs/jobStore";
import { AboutScreen } from "./screens/AboutScreen";
import { aboutStrings } from "./strings";

const ABOUT_PATH = "/about";

export const aboutFeature = defineFeature({
	id: "about",
	title: aboutStrings.title,
	routes: [{ path: ABOUT_PATH, component: AboutScreen }],
	// The demo job's notices belong to About; "Show" runs about.show.
	jobs: ["about.demoJob"],
	show: "about.show",
	commands: [
		defineCommand({
			id: "about.show",
			title: aboutStrings.commands.show,
			when: canNavigate,
			run: () => navigateTo(ABOUT_PATH),
		}),
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
