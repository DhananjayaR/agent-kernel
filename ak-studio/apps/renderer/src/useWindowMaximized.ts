// Whether the window is maximised, from the `window.state` stream (the current state at once, then each change).
// False until the first event, and when the stream cannot start (the bridge is missing: the shell shows its error).
import { useEffect, useState } from "react";
import { getTransport } from "./bridge/client";

export function useWindowMaximized(): boolean {
	const [maximized, setMaximized] = useState(false);
	useEffect(
		() =>
			getTransport().subscribe("window.state", {}, (event) =>
				setMaximized(event.maximized),
			),
		[],
	);
	return maximized;
}
