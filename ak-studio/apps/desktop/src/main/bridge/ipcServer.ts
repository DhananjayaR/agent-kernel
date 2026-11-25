// The IPC side of the bridge: one `ipcMain.handle` for requests and the subscribe/unsubscribe channel pair, all
// served by the ServiceRegistry. Every message is checked to come from the top frame of one of the app's own
// windows, on the app's origin (or, in unpackaged builds, the validated dev server's); a request that fails the
// check answers `bridge.forbidden`, a send that fails it is ignored and logged. A window's subscriptions end
// when it is destroyed, its renderer dies, or its page navigates. Only `import type` from electron: see
// security.ts.
import {
	type BridgeResult,
	ERROR_CODES,
	fail,
	type StreamMessage,
	type StudioError,
	toStudioError,
} from "@ak-studio/contract";
import type {
	IpcMain,
	IpcMainEvent,
	IpcMainInvokeEvent,
	WebContents,
} from "electron";
import { BRIDGE_CHANNELS, type EventMessage } from "../../shared/channels";
import { APP_ORIGIN, describeOrigin } from "../security";

/** What the IPC server needs from the ServiceRegistry. */
export interface BridgeRegistry {
	request(name: unknown, input: unknown): Promise<BridgeResult>;
	subscribe(
		name: unknown,
		input: unknown,
		send: (message: StreamMessage) => void,
	): BridgeResult<() => void>;
}

export interface BridgeServerOptions {
	registry: BridgeRegistry;
	/** Whether `contents` belongs to one of the app's own windows. */
	isAppContents: (contents: WebContents) => boolean;
	/** Origins a message may come from: see `trustedOrigins`. */
	allowedOrigins: readonly string[];
	log?: (message: string) => void;
}

/** The longest subscription id accepted (the preload uses UUIDs). */
export const MAX_SUBSCRIPTION_ID_LENGTH = 128;

/** `scheme://host` of a URL. Unlike `URL.origin`, this works for the custom `app:` scheme (which gives "null"). */
export function originOf(rawUrl: string): string | undefined {
	try {
		const url = new URL(rawUrl);
		return url.host ? `${url.protocol}//${url.host}` : undefined;
	} catch {
		return undefined;
	}
}

/** The app's own origin, plus the dev server's when there is one (unpackaged builds only: see security.ts). */
export function trustedOrigins(devServerUrl?: string): string[] {
	const dev = devServerUrl ? originOf(devServerUrl) : undefined;
	return dev ? [APP_ORIGIN, dev] : [APP_ORIGIN];
}

type BridgeEvent = Pick<IpcMainEvent | IpcMainInvokeEvent, "sender"> & {
	readonly senderFrame: IpcMainEvent["senderFrame"];
};

/** Why a message must be refused, or undefined if it comes from the app's own window and origin. */
export function senderRefusal(
	event: BridgeEvent,
	isAppContents: (contents: WebContents) => boolean,
	allowedOrigins: readonly string[],
): string | undefined {
	try {
		const frame = event.senderFrame;
		if (!frame) return "no sender frame (it navigated or was destroyed)";
		if (frame.parent !== null) return "a subframe";
		if (!isAppContents(event.sender)) return "not one of the app's windows";
		const origin = originOf(frame.url);
		if (!origin || !allowedOrigins.includes(origin)) {
			return `origin ${describeOrigin(frame.url)}`;
		}
		return undefined;
	} catch (err) {
		// A frame disposed mid-check throws on access.
		return `sender check failed: ${String(err)}`;
	}
}

function forbidden(reason: string): StudioError {
	return {
		code: ERROR_CODES.forbidden,
		message: "The app refused a message from outside its own window.",
		detail: reason,
	};
}

function isSubscribeMessage(
	value: unknown,
): value is { id: string; op: unknown; input: unknown } {
	if (typeof value !== "object" || value === null) return false;
	const id = (value as { id?: unknown }).id;
	return (
		typeof id === "string" &&
		id.length > 0 &&
		id.length <= MAX_SUBSCRIPTION_ID_LENGTH
	);
}

const isUnsubscribeMessage = isSubscribeMessage;

export class BridgeServer {
	readonly #options: BridgeServerOptions;
	readonly #log: (message: string) => void;
	/** Live subscriptions: per window contents, by the renderer's subscription id. */
	readonly #subs = new Map<WebContents, Map<string, () => void>>();
	readonly #hooked = new WeakSet<WebContents>();

	constructor(options: BridgeServerOptions) {
		this.#options = options;
		this.#log =
			options.log ?? ((message) => console.warn(`[studio] bridge: ${message}`));
	}

	/** Registers the three renderer-to-main channels on `ipcMain`. Returns the function that removes them. */
	install(ipcMain: IpcMain): () => void {
		const onSubscribe = (event: IpcMainEvent, msg: unknown) =>
			this.subscribe(event, msg);
		const onUnsubscribe = (event: IpcMainEvent, msg: unknown) =>
			this.unsubscribe(event, msg);
		ipcMain.handle(BRIDGE_CHANNELS.request, (event, op: unknown, input) =>
			this.request(event, op, input),
		);
		ipcMain.on(BRIDGE_CHANNELS.subscribe, onSubscribe);
		ipcMain.on(BRIDGE_CHANNELS.unsubscribe, onUnsubscribe);
		return () => {
			ipcMain.removeHandler(BRIDGE_CHANNELS.request);
			ipcMain.removeListener(BRIDGE_CHANNELS.subscribe, onSubscribe);
			ipcMain.removeListener(BRIDGE_CHANNELS.unsubscribe, onUnsubscribe);
			for (const contents of [...this.#subs.keys()]) this.#cancelAll(contents);
		};
	}

	/** `bridge:request`. Always resolves with a result envelope; never throws across the bridge. */
	async request(
		event: BridgeEvent,
		op: unknown,
		input: unknown,
	): Promise<BridgeResult> {
		try {
			const refused = this.#refusal(event);
			if (refused) {
				this.#log(`refused a request: ${refused}`);
				return fail(forbidden(refused));
			}
			return await this.#options.registry.request(op, input);
		} catch (err) {
			return fail(toStudioError(err));
		}
	}

	/** `bridge:subscribe`. A failure to start is sent back as the stream's one `ok: false` message. */
	subscribe(event: BridgeEvent, msg: unknown): void {
		const refused = this.#refusal(event);
		if (refused) {
			this.#log(`ignored a subscribe: ${refused}`);
			return;
		}
		if (!isSubscribeMessage(msg)) {
			this.#log("ignored a malformed subscribe message");
			return;
		}
		const contents = event.sender;
		const { id } = msg;
		const live = this.#subs.get(contents);
		if (live?.has(id)) {
			this.#log("ignored a subscribe that reuses a live subscription id");
			return;
		}
		const send = (message: StreamMessage) => this.#send(contents, id, message);
		let result: BridgeResult<() => void>;
		try {
			result = this.#options.registry.subscribe(msg.op, msg.input, send);
		} catch (err) {
			result = fail(toStudioError(err));
		}
		if (!result.ok) {
			send(result);
			return;
		}
		this.#hook(contents);
		const map = live ?? new Map<string, () => void>();
		map.set(id, result.value);
		this.#subs.set(contents, map);
	}

	/** `bridge:unsubscribe`. Only the window that owns a subscription can end it. */
	unsubscribe(event: BridgeEvent, msg: unknown): void {
		const refused = this.#refusal(event);
		if (refused) {
			this.#log(`ignored an unsubscribe: ${refused}`);
			return;
		}
		if (!isUnsubscribeMessage(msg)) return;
		const map = this.#subs.get(event.sender);
		const cancel = map?.get(msg.id);
		if (!map || !cancel) return;
		map.delete(msg.id);
		if (map.size === 0) this.#subs.delete(event.sender);
		cancel();
	}

	/** Live subscriptions, for one window or all. */
	subscriptionCount(contents?: WebContents): number {
		if (contents) return this.#subs.get(contents)?.size ?? 0;
		let n = 0;
		for (const map of this.#subs.values()) n += map.size;
		return n;
	}

	#refusal(event: BridgeEvent): string | undefined {
		return senderRefusal(
			event,
			this.#options.isAppContents,
			this.#options.allowedOrigins,
		);
	}

	#send(contents: WebContents, id: string, event: StreamMessage): void {
		if (contents.isDestroyed()) return;
		try {
			contents.send(BRIDGE_CHANNELS.event, {
				id,
				event,
			} satisfies EventMessage);
		} catch (err) {
			this.#log(`could not send a stream message: ${String(err)}`);
		}
	}

	// `destroyed` does not fire on reload or navigation, so the page committing a new document (`did-navigate`,
	// main frame only) and the renderer process dying also end the window's subscriptions. Not
	// `did-start-navigation`: it fires before `will-navigate` can block a navigation, so a refused navigation
	// would end the streams of a page that is still there.
	#hook(contents: WebContents): void {
		if (this.#hooked.has(contents)) return;
		this.#hooked.add(contents);
		const end = () => this.#cancelAll(contents);
		contents.once("destroyed", end);
		contents.on("render-process-gone", end);
		contents.on("did-navigate", end);
	}

	#cancelAll(contents: WebContents): void {
		const map = this.#subs.get(contents);
		if (!map) return;
		this.#subs.delete(contents);
		for (const cancel of map.values()) {
			try {
				cancel();
			} catch (err) {
				this.#log(`could not stop a stream: ${String(err)}`);
			}
		}
	}
}
