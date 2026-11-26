// The app's providers: the query client, the one `events` subscription (connectEvents) feeding the job and session
// stores, which reattach from `jobs.list` and `sessions.list` each time it opens (events/reattach.ts), the theme
// and the router. The stream store needs no provider: each view's useStream holds its own subscription.
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { getTransport } from "../shared/bridge/client";
import { connectEvents } from "../shared/events/connectEvents";
import { storeEventHandlers } from "../shared/events/reattach";
import { createQueryClient } from "../shared/query/client";
import { createAppRouter } from "./routes/router";
import { useAppTheme } from "./useAppTheme";

function Themed({ children }: { children: ReactNode }) {
	useAppTheme();
	return children;
}

export function App() {
	const [queryClient] = useState(createQueryClient);
	const [router] = useState(createAppRouter);
	useEffect(() => {
		const transport = getTransport();
		return connectEvents(queryClient, transport, storeEventHandlers(transport));
	}, [queryClient]);
	return (
		<QueryClientProvider client={queryClient}>
			<Themed>
				<RouterProvider router={router} />
			</Themed>
		</QueryClientProvider>
	);
}
