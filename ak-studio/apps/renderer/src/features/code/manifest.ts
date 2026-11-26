// The Code feature's manifest: how it joins the app (architecture.md, Features). Its tab, the route that tab
// shows, its app commands (none yet) and the kernel capabilities it uses (none yet). The only file app/ imports.
import { defineFeature } from "../../shared/commands/feature";
import { CodeScreen } from "./screens/CodeScreen";
import { codeStrings } from "./strings";

export const codeFeature = defineFeature({
	id: "code",
	title: codeStrings.tab,
	tab: { label: codeStrings.tab, path: "/code", order: 2 },
	routes: [{ path: "/code", component: CodeScreen }],
	commands: [],
	capabilities: [],
});
