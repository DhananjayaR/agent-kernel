// Violation: a contract test imports a Node built-in.
import { readFileSync } from "node:fs";
import { expect } from "vitest";
export const t = [readFileSync, expect];
