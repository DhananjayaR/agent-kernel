// Allowed: the preload script imports Electron values.
import { contextBridge } from "electron";
export const preload = contextBridge;
