// The preload exposes exactly one global, `window.studio`, and nothing else (no ipcRenderer, no Node).
// It runs sandboxed, so it is bundled to CommonJS with no imports but `electron`.
import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";
import {
	BRIDGE_CHANNELS,
	type EventMessage,
	type SubscribeMessage,
	type UnsubscribeMessage,
} from "../shared/channels";

function assertOp(op: unknown): asserts op is string {
	if (typeof op !== "string" || op.length === 0) {
		throw new TypeError("studio: operation name must be a non-empty string");
	}
}

const studio = {
	request(op: string, input: unknown): Promise<unknown> {
		assertOp(op);
		return ipcRenderer.invoke(BRIDGE_CHANNELS.request, op, input);
	},

	subscribe(
		op: string,
		input: unknown,
		onEvent: (event: unknown) => void,
	): () => void {
		assertOp(op);
		if (typeof onEvent !== "function") {
			throw new TypeError("studio: onEvent must be a function");
		}
		const id = crypto.randomUUID();
		const listener = (_e: IpcRendererEvent, msg: EventMessage): void => {
			if (msg?.id === id) onEvent(msg.event);
		};
		ipcRenderer.on(BRIDGE_CHANNELS.event, listener);
		ipcRenderer.send(BRIDGE_CHANNELS.subscribe, {
			id,
			op,
			input,
		} satisfies SubscribeMessage);
		let active = true;
		return () => {
			if (!active) return;
			active = false;
			ipcRenderer.removeListener(BRIDGE_CHANNELS.event, listener);
			ipcRenderer.send(BRIDGE_CHANNELS.unsubscribe, {
				id,
			} satisfies UnsubscribeMessage);
		};
	},
};

contextBridge.exposeInMainWorld("studio", studio);
