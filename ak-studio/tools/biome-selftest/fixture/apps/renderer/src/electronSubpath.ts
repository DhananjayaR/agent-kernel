// Violation: an electron subpath import in the renderer.
import { ipcRenderer } from "electron/renderer";
export const a = ipcRenderer;
