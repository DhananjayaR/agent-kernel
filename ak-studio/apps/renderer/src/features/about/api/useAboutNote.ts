// useAboutNote: reads `about.note` into the query cache under the About feature's keys (keys.ts), through the
// shared query hook (a pending state after 300 ms; failures as StudioFailure).
import {
	type StudioQueryResult,
	useStudioQuery,
} from "../../../shared/query/hooks";
import { aboutKeys } from "./keys";

/** About: note. */
export function useAboutNote(): StudioQueryResult<"about.note"> {
	return useStudioQuery("about.note", {}, { key: aboutKeys.app("note") });
}
