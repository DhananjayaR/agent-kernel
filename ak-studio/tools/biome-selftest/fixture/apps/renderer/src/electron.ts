// Violation: an electron import in the renderer.
import { ipcRenderer } from "electron";
export const a = ipcRenderer;
