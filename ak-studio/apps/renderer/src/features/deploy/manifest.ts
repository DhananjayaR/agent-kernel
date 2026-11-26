// The Deploy feature's manifest: how it joins the app (architecture.md, Features). Its tab, the route that tab
// shows, its app commands (none yet) and the kernel capabilities it uses (none yet). The only file app/ imports.
import { defineFeature } from "../../shared/commands/feature";
import { DeployScreen } from "./screens/DeployScreen";
import { deployStrings } from "./strings";

export const deployFeature = defineFeature({
	id: "deploy",
	tab: { label: deployStrings.tab, path: "/deploy", order: 5 },
	routes: [{ path: "/deploy", component: DeployScreen }],
	commands: [],
	capabilities: [],
});
