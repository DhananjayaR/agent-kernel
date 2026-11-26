// A mock backend wired as App.tsx wires the app, for hook tests that need what comes back as events: the transport
// set, a query client, and the one `events` subscription feeding the job and session stores (and refreshing
// queries on `domain.changed`). The stores are module singletons, so it empties them first. Tests pass the
// mock's options (a FakeClock from @ak-studio/runtime, so steps and ticks run at once) and call `dispose`.
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { setTransport } from "../shared/bridge/client";
import {
	createMockBackend,
	type MockBackend,
	type MockTransportOptions,
} from "../shared/bridge/mockTransport";
import { connectEvents } from "../shared/events/connectEvents";
import { storeEventHandlers } from "../shared/events/reattach";
import { useJobStore } from "../shared/jobs/jobStore";
import { createQueryClient } from "../shared/query/client";
import { useSessionStore } from "../shared/sessions/sessionStore";
import { useStreamStore } from "../shared/streams/streamStore";

export interface ConnectedMock {
	backend: MockBackend;
	/** Wraps a rendered hook or component in the query client. */
	wrapper: (props: { children: ReactNode }) => ReactNode;
	/** Closes the events subscription and unsets the transport. */
	dispose(): void;
}

export function connectMock(options: MockTransportOptions = {}): ConnectedMock {
	useJobStore.setState({ jobs: {} });
	useSessionStore.setState({ sessions: {} });
	useStreamStore.setState({ streams: {} });
	const backend = createMockBackend(options);
	setTransport(backend.transport);
	const client = createQueryClient();
	const disconnect = connectEvents(
		client,
		backend.transport,
		storeEventHandlers(backend.transport),
	);
	return {
		backend,
		wrapper: ({ children }) => (
			<QueryClientProvider client={client}>{children}</QueryClientProvider>
		),
		dispose: () => {
			disconnect();
			client.clear();
			setTransport(undefined);
		},
	};
}
