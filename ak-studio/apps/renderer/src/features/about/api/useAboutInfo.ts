// useAboutInfo: reads `about.info` into the query cache under the About feature's keys (keys.ts), through the
// shared query hook (a pending state after 300 ms; failures as StudioFailure).
import {
	type StudioQueryResult,
	useStudioQuery,
} from "../../../shared/query/hooks";
import { aboutKeys } from "./keys";

/** About: info. */
export function useAboutInfo(): StudioQueryResult<"about.info"> {
	return useStudioQuery("about.info", {}, { key: aboutKeys.app("info") });
}
