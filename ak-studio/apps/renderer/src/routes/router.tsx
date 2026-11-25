// The app's routes: one per app tab under the shell (`#/canvas`, `#/code`, ...); `#/` and any unknown tab open the
// canvas. Hash history, because the app is served from app://studio/ and has no server to resolve other paths.
import { isAppTabId } from "@ak-studio/ui";
import {
	createHashHistory,
	createRootRoute,
	createRoute,
	createRouter,
	redirect,
} from "@tanstack/react-router";
import { DEFAULT_TAB } from "../shell/routes";
import { Shell } from "../shell/Shell";
import { TabEmptyState } from "../shell/TabEmptyState";

const rootRoute = createRootRoute({ component: Shell });

const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	beforeLoad: () => {
		throw redirect({ to: "/$tab", params: { tab: DEFAULT_TAB } });
	},
});

const tabRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/$tab",
	beforeLoad: ({ params }) => {
		if (!isAppTabId(params.tab))
			throw redirect({ to: "/$tab", params: { tab: DEFAULT_TAB } });
	},
	component: TabView,
});

function TabView() {
	const { tab } = tabRoute.useParams();
	return isAppTabId(tab) ? <TabEmptyState tab={tab} /> : null;
}

export function createAppRouter() {
	return createRouter({
		routeTree: rootRoute.addChildren([indexRoute, tabRoute]),
		history: createHashHistory(),
	});
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof createAppRouter>;
	}
}
