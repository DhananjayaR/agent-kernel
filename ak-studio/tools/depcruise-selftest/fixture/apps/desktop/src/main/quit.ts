// Violation: an Electron value import outside the entry points.
import { dialog } from "electron";
export const quit = dialog;
