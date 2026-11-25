// PLACEHOLDER: this unstyled page is replaced by the shell (tabs, layout, styling) in Task 10, after the design
// gate. It exists to prove the bridge and the theme preference work end to end.
import type { ThemePreference } from "@ak-studio/contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTransportKind, isStudioFailure } from "../bridge/client";
import {
	appInfoQueryKey,
	cacheStoredTheme,
	fetchAppInfo,
	storeTheme,
} from "../queries";

const THEMES: readonly ThemePreference[] = ["system", "dark", "light"];

function describeError(error: unknown): string {
	return isStudioFailure(error) ? error.error.message : String(error);
}

export function Home() {
	const queryClient = useQueryClient();
	const info = useQuery({ queryKey: appInfoQueryKey, queryFn: fetchAppInfo });
	const setTheme = useMutation({
		mutationFn: storeTheme,
		onSuccess: (stored) => cacheStoredTheme(queryClient, stored),
	});

	return (
		<main>
			<h1>Agent Kernel Studio</h1>
			<p>Placeholder page (replaced by the shell in Task 10).</p>
			{info.isPending && <p>Loading...</p>}
			{info.isError && <p role="alert">{describeError(info.error)}</p>}
			{info.data && (
				<>
					<p>
						Version <span data-testid="version">{info.data.version}</span>,
						platform <span data-testid="platform">{info.data.platform}</span>{" "}
						(bridge: <span data-testid="bridge">{getTransportKind()}</span>)
					</p>
					<label>
						Theme{" "}
						<select
							data-testid="theme"
							value={info.data.theme}
							disabled={setTheme.isPending}
							onChange={(event) =>
								setTheme.mutate(event.target.value as ThemePreference)
							}
						>
							{THEMES.map((value) => (
								<option key={value} value={value}>
									{value}
								</option>
							))}
						</select>
					</label>
					<p>
						Stored preference:{" "}
						<span data-testid="stored-theme">{info.data.theme}</span>
					</p>
				</>
			)}
			{setTheme.isError && <p role="alert">{describeError(setTheme.error)}</p>}
		</main>
	);
}
