// The preload exposes exactly one global, `window.studio`, and nothing else (no ipcRenderer, no Node).
// It runs sandboxed, so it is bundled to CommonJS with no imports but `electron` (the contract import is types
// only). The main process answers requests with result envelopes; the preload passes them through unchanged.
import type { StudioBridge } from "@ak-studio/contract";
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

// One `bridge:event` listener for the whole page, dispatching by subscription id.
const subscribers = new Map<string, (event: unknown) => void>();
ipcRenderer.on(
	BRIDGE_CHANNELS.event,
	(_e: IpcRendererEvent, msg: EventMessage): void => {
		if (typeof msg?.id === "string") subscribers.get(msg.id)?.(msg.event);
	},
);

/** For unit tests: the number of live subscriptions. Not exposed to the page. */
export function activeSubscriptionCount(): number {
	return subscribers.size;
}

const studio: StudioBridge = {
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
		// Throws if `input` cannot be cloned; nothing is registered in that case.
		ipcRenderer.send(BRIDGE_CHANNELS.subscribe, {
			id,
			op,
			input,
		} satisfies SubscribeMessage);
		subscribers.set(id, onEvent);
		return () => {
			if (!subscribers.delete(id)) return;
			ipcRenderer.send(BRIDGE_CHANNELS.unsubscribe, {
				id,
			} satisfies UnsubscribeMessage);
		};
	},
};

contextBridge.exposeInMainWorld("studio", studio);
