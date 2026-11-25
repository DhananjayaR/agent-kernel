// Allowed: a contract test may import vitest, zod and contract files.
import { expect } from "vitest";
import { z } from "zod";
import { x } from "./index";
export const t = [expect, z, x];
