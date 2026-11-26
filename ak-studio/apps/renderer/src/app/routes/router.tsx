// The app's routes, from the registry (the feature manifests): each feature's routes under the shell (`#/canvas`,
// `#/code`, ...). `#/` and any unknown path open the first tab, the canvas. Hash history, because the app is served
// from app://studio/ and has no server to resolve other paths. Matching is case-sensitive, so `#/Canvas` is
// unknown, as before the manifests.
import {
	createHashHistory,
	createRootRoute,
	createRoute,
	createRouter,
	redirect,
} from "@tanstack/react-router";
import { registry } from "../registry";
import { Shell } from "../shell/Shell";

const rootRoute = createRootRoute({ component: Shell });

const toDefaultTab = () => {
	throw redirect({ to: registry.defaultTab.path });
};

const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	beforeLoad: toDefaultTab,
});

const featureRoutes = registry.routes.map((route) =>
	createRoute({
		getParentRoute: () => rootRoute,
		path: route.path,
		component: route.component,
	}),
);

/** Anything no feature has a route for. */
const unknownRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "$",
	beforeLoad: toDefaultTab,
});

export function createAppRouter() {
	return createRouter({
		routeTree: rootRoute.addChildren([
			indexRoute,
			...featureRoutes,
			unknownRoute,
		]),
		history: createHashHistory(),
		caseSensitive: true,
	});
}
