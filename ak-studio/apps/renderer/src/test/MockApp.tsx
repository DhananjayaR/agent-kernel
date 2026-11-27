// MockApp: a screen on the mock backend, wired as App.tsx wires the app, for screen stories and screen tests. It
// connects the mock (connectMock: the transport, a query client, the one `events` subscription feeding the job and
// session stores), mounts the children in a router (memory history: the screen at "/", and "/other" to leave to, as
// the unsaved changes guard needs a router), and sets the patterns' clock (ClockProvider) to the mock's, so a
// FakeClock passed in `options.clock` freezes elapsed times too. The mock is disposed when MockApp unmounts.
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";
import type {
	MockBackend,
	MockTransportOptions,
} from "../shared/bridge/mockTransport";
import { ClockProvider } from "../shared/patterns/clock";
import { connectMock } from "./connectedMock";

/** The route "/" renders what MockApp was given (the router is made once; its children may change). */
const ScreenContext = createContext<ReactNode>(null);

function Screen() {
	return useContext(ScreenContext);
}

function createMockRouter() {
	const rootRoute = createRootRoute({ component: Outlet });
	return createRouter({
		routeTree: rootRoute.addChildren([
			createRoute({
				getParentRoute: () => rootRoute,
				path: "/",
				component: Screen,
			}),
			createRoute({
				getParentRoute: () => rootRoute,
				path: "/other",
				component: () => <p>Other view</p>,
			}),
		]),
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});
}

export type MockRouter = ReturnType<typeof createMockRouter>;

export interface MockAppProps {
	/** The mock's options: a FakeClock, handler overrides, latency. */
	options?: MockTransportOptions;
	/** Called once with the backend and the router, before the first render of the children. */
	onReady?: (backend: MockBackend, router: MockRouter) => void;
	children: ReactNode;
}

export function MockApp({ options, onReady, children }: MockAppProps) {
	const [mock] = useState(() => connectMock(options));
	const [router] = useState(() => {
		const made = createMockRouter();
		onReady?.(mock.backend, made);
		return made;
	});
	useEffect(() => () => mock.dispose(), [mock]);
	const clock = options?.clock;
	const Wrapper = mock.wrapper;
	const app = (
		<Wrapper>
			<ScreenContext.Provider value={children}>
				<RouterProvider router={router} />
			</ScreenContext.Provider>
		</Wrapper>
	);
	return clock ? (
		<ClockProvider now={() => clock.now()}>{app}</ClockProvider>
	) : (
		app
	);
}
