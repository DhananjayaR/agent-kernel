// The Config feature's manifest: how it joins the app (architecture.md, Features). Its tab, the route that tab
// shows, its app commands (none yet) and the kernel capabilities it uses (none yet). The only file app/ imports.
import { defineFeature } from "../../shared/commands/feature";
import { ConfigScreen } from "./screens/ConfigScreen";
import { configStrings } from "./strings";

export const configFeature = defineFeature({
	id: "config",
	tab: { label: configStrings.tab, path: "/config", order: 3 },
	routes: [{ path: "/config", component: ConfigScreen }],
	commands: [],
	capabilities: [],
});
