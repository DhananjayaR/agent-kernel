// The app's providers: the query client, the one `events` subscription (connectEvents; Task 8 adds the stores'
// callbacks), the theme and the router.
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { getTransport } from "../shared/bridge/client";
import { connectEvents } from "../shared/events/connectEvents";
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
	useEffect(() => connectEvents(queryClient, getTransport()), [queryClient]);
	return (
		<QueryClientProvider client={queryClient}>
			<Themed>
				<RouterProvider router={router} />
			</Themed>
		</QueryClientProvider>
	);
}
