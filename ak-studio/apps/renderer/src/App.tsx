import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { createQueryClient } from "./queries";
import { createAppRouter } from "./routes/router";
import { useAppTheme } from "./useAppTheme";

function Themed({ children }: { children: ReactNode }) {
	useAppTheme();
	return children;
}

export function App() {
	const [queryClient] = useState(createQueryClient);
	const [router] = useState(createAppRouter);
	return (
		<QueryClientProvider client={queryClient}>
			<Themed>
				<RouterProvider router={router} />
			</Themed>
		</QueryClientProvider>
	);
}
