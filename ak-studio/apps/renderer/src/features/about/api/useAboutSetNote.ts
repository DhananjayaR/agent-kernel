// useAboutSetNote: runs `about.setNote` through the shared mutation hook (a pending state after 300 ms; failures as
// StudioFailure). What it changes comes back through a domain event or its onSuccess, never an optimistic write.
import {
	type StudioMutationOptions,
	type StudioMutationResult,
	useStudioMutation,
} from "../../../shared/query/hooks";

/** About: set note. */
export function useAboutSetNote(
	options: StudioMutationOptions<"about.setNote"> = {},
): StudioMutationResult<"about.setNote"> {
	return useStudioMutation("about.setNote", options);
}
