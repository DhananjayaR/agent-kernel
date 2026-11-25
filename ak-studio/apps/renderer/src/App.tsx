import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { useState } from "react";
import { createQueryClient } from "./queries";
import { createAppRouter } from "./routes/router";

export function App() {
	const [queryClient] = useState(createQueryClient);
	const [router] = useState(createAppRouter);
	return (
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	);
}
