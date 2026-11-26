// The Canvas feature's manifest: how it joins the app (architecture.md, Features). Its tab, the route that tab
// shows, its app commands (none yet) and the kernel capabilities it uses (none yet). The only file app/ imports.
import { defineFeature } from "../../shared/commands/feature";
import { CanvasScreen } from "./screens/CanvasScreen";
import { canvasStrings } from "./strings";

export const canvasFeature = defineFeature({
	id: "canvas",
	title: canvasStrings.tab,
	tab: { label: canvasStrings.tab, path: "/canvas", order: 1 },
	routes: [{ path: "/canvas", component: CanvasScreen }],
	commands: [],
	capabilities: [],
});
