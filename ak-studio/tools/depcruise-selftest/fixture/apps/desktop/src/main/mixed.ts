// Violation: a mixed import (a type and a value) brings in Electron code.
import { type BrowserWindow, app } from "electron";
export const mixed: [typeof app, BrowserWindow?] = [app];
