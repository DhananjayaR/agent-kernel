// The app's TanStack Query client. A failed bridge call is a StudioFailure the view shows; retrying would only
// delay that, and focus does not refetch: domain events (connectEvents) say when server data changed.
import { QueryClient } from "@tanstack/react-query";

export function createQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
	});
}
