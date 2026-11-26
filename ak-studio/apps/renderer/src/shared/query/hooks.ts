// The renderer's query and command hooks: TanStack Query over the bridge, typed from the contract. A query takes
// its key from the domain's key factory (keys.ts); a command only writes and never touches the cache itself (no
// optimistic writes, architecture rule 1): what it changed comes back through a domain event or its onSuccess.
// Both expose `showPending`, true only once the call has run for 300 ms.
import {
	ERROR_CODES,
	type InputOf,
	type OperationName,
	type Operations,
	type OutputOf,
} from "@ak-studio/contract";
import {
	type QueryKey,
	type UseMutationResult,
	type UseQueryResult,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { getTransport, isStudioFailure, StudioFailure } from "../bridge/client";
import { errorStrings } from "../errors/strings";
import { usePendingAfter } from "./pending";

/** The operations declared as queries: what `useStudioQuery` reads. */
export type QueryOperationName = {
	[N in OperationName]: Operations[N] extends { readonly shape: "query" }
		? N
		: never;
}[OperationName];

/** The operations declared as commands: what `useStudioMutation` writes with. */
export type CommandOperationName = {
	[N in OperationName]: Operations[N] extends { readonly shape: "command" }
		? N
		: never;
}[OperationName];

export interface StudioQueryOptions {
	/** Built with `keys(domain)`: `[domain]` for app-level data, else `[domain, projectId, ...detail]`. */
	key: QueryKey;
	enabled?: boolean;
}

export type StudioQueryResult<N extends QueryOperationName> = UseQueryResult<
	OutputOf<N>,
	StudioFailure
> & { showPending: boolean };

export interface StudioMutationOptions<N extends CommandOperationName> {
	onSuccess?: (output: OutputOf<N>, input: InputOf<N>) => void;
	onError?: (error: StudioFailure, input: InputOf<N>) => void;
}

export type StudioMutationResult<N extends CommandOperationName> =
	UseMutationResult<OutputOf<N>, StudioFailure, InputOf<N>> & {
		showPending: boolean;
	};

/** One bridge call whose failure is always a StudioFailure (the transports already reject with one). */
export async function requestStudio<N extends OperationName>(
	name: N,
	input: InputOf<N>,
): Promise<OutputOf<N>> {
	try {
		return await getTransport().request(name, input);
	} catch (err) {
		if (isStudioFailure(err)) throw err;
		throw new StudioFailure({
			code: ERROR_CODES.internal,
			message: errorStrings.unexpectedFailure,
			detail: err instanceof Error ? err.message : String(err),
		});
	}
}

/** Reads a query operation into the cache under `key`. `showPending` is true once a fetch has run for 300 ms. */
export function useStudioQuery<N extends QueryOperationName>(
	name: N,
	input: InputOf<N>,
	options: StudioQueryOptions,
): StudioQueryResult<N> {
	const query = useQuery<OutputOf<N>, StudioFailure>({
		queryKey: options.key,
		queryFn: () => requestStudio(name, input),
		enabled: options.enabled,
	});
	// The fetch in flight, read from the cache (not through the result, which would track it): each fetch, a
	// refetch that replaces a cancelled one included, has its own promise, so each gets its own 300 ms.
	const fetch = useQueryClient()
		.getQueryCache()
		.find({ queryKey: options.key, exact: true })?.promise;
	const showPending = usePendingAfter(query.isFetching, fetch);
	// TanStack's result is a Proxy that records which fields a render reads, so it re-renders only when those
	// change. A spread would read them all, and assigning onto it would change TanStack's own object: wrap it.
	return new Proxy(query, {
		get: (target, key) =>
			key === "showPending" ? showPending : Reflect.get(target, key),
		has: (target, key) => key === "showPending" || Reflect.has(target, key),
	}) as StudioQueryResult<N>;
}

/** Runs a command. `showPending` is true once a write has run for 300 ms, until it settles. */
export function useStudioMutation<N extends CommandOperationName>(
	name: N,
	options: StudioMutationOptions<N> = {},
): StudioMutationResult<N> {
	const mutation = useMutation<OutputOf<N>, StudioFailure, InputOf<N>>({
		mutationFn: (input) => requestStudio(name, input),
		onSuccess: (output, input) => options.onSuccess?.(output, input),
		onError: (error, input) => options.onError?.(error, input),
	});
	// Each `mutate` is a new submission: its own 300 ms, even when it follows the last one with no idle render.
	const showPending = usePendingAfter(mutation.isPending, mutation.submittedAt);
	return { ...mutation, showPending };
}
