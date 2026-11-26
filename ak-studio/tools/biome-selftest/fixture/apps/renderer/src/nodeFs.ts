// Violation: a node: built-in in the renderer.
import { readFileSync } from "node:fs";
export const a = readFileSync;
