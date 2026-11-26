// Violation: a feature imports @ak-studio/runtime instead of going through the bridge.
import { runtime } from "@ak-studio/runtime";
export const usesRuntime = runtime;
