// The About feature's query keys (architecture.md, "Where each kind of data lives", rule 4): every key its hooks
// use is built from this factory, so a `domain.changed` event for `about` refreshes them all.
import { keys } from "../../../shared/query/keys";

export const aboutKeys = keys("about");
