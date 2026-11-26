// Allowed: the main process imports electron and Node built-ins.
import { join } from "node:path";
import { app } from "electron";
export const a = [app, join];
