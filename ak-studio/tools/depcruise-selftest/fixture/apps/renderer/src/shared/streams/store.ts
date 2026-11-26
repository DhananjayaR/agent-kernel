// Violation: shared/ code outside the bridge imports the runtime.
import { runtime } from "@ak-studio/runtime";
export const store = runtime;
