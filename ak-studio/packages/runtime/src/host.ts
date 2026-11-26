// The default log line for the runtime's services. The runtime runs in the Electron main process and in the
// browser (the mock transport), and both have `console`; services take a `log` option so tests can watch it.

/** Where a service reports a bug or a failure nobody else will see. */
export type Log = (message: string) => void;

export const defaultLog: Log = (message) =>
	console.error(`[studio] ${message}`);
