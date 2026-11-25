// Whether a component renders inside an overlay (Modal, Popover). Collections read it to decide what Escape does:
// inside an overlay Escape closes the overlay; outside, it clears a collection's selection.
import { createContext, useContext } from "react";

export const InOverlayContext = createContext(false);

/** True inside a Modal or a Popover from this package. */
export function useInOverlay(): boolean {
	return useContext(InOverlayContext);
}
