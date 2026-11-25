// Runs before any schema in the contract is built. zod 4 probes `new Function` when a `z.object` is constructed
// (for its JIT parser); under the renderer's `script-src 'self'` CSP that probe is blocked and reported as a
// `securitypolicyviolation`. `jitless` skips the probe and the JIT. Every contract module that builds a schema
// imports this file first, so ES module order guarantees it runs before the first `z.object`.
import { z } from "zod";

z.config({ jitless: true });
