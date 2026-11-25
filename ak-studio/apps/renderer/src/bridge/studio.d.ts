// `window.studio`: present when the renderer runs in the Electron app (the preload exposes it), absent in a
// plain browser. The type comes from the contract, so the renderer never imports apps/desktop.
import type { StudioBridge } from "@ak-studio/contract";

declare global {
	interface Window {
		studio?: StudioBridge;
	}
}
