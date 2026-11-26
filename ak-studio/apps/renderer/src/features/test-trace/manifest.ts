// The Test & trace feature's manifest: how it joins the app (architecture.md, Features). Its tab, the route that tab
// shows, its app commands (none yet) and the kernel capabilities it uses (none yet). The only file app/ imports.
import { defineFeature } from "../../shared/commands/feature";
import { TestTraceScreen } from "./screens/TestTraceScreen";
import { testTraceStrings } from "./strings";

export const testTraceFeature = defineFeature({
	id: "test-trace",
	tab: { label: testTraceStrings.tab, path: "/test-trace", order: 4 },
	routes: [{ path: "/test-trace", component: TestTraceScreen }],
	commands: [],
	capabilities: [],
});
