import { readFileSync } from "node:fs";
import { join } from "path";
import { x } from "../../contract/src/index";
export const ui = [readFileSync, join, x];
