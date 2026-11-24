// IPC channel names shared by the preload and the main process (Task 4 adds the main-side handlers).
//
// request:     renderer -> main, ipcRenderer.invoke(REQUEST, op, input) resolves with the handler's result.
// subscribe:   renderer -> main, ipcRenderer.send(SUBSCRIBE, { id, op, input }).
// event:       main -> renderer, webContents.send(EVENT, { id, event }) for each event of subscription `id`.
// unsubscribe: renderer -> main, ipcRenderer.send(UNSUBSCRIBE, { id }).
export const BRIDGE_CHANNELS = {
	request: "bridge:request",
	subscribe: "bridge:subscribe",
	event: "bridge:event",
	unsubscribe: "bridge:unsubscribe",
} as const;

export interface SubscribeMessage {
	id: string;
	op: string;
	input: unknown;
}

export interface EventMessage {
	id: string;
	event: unknown;
}

export interface UnsubscribeMessage {
	id: string;
}
