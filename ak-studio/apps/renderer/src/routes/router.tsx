// One route for now; the shell's routes arrive in Task 10. Hash history, because the app is served from
// app://studio/ and has no server to resolve other paths.
import {
	createHashHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
} from "@tanstack/react-router";
import { Home } from "./Home";

const rootRoute = createRootRoute({ component: Outlet });
const homeRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: Home,
});

export function createAppRouter() {
	return createRouter({
		routeTree: rootRoute.addChildren([homeRoute]),
		history: createHashHistory(),
	});
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof createAppRouter>;
	}
}
