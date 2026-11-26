// The CommandRunner port: the only way a service starts a process (architecture, "Main-process services").
// The desktop implements it on Node from P2; tests and the browser's mock use FakeCommandRunner.
import type { StreamChannel } from "@ak-studio/contract";

/** The channels a process writes to. */
export type CommandOutputChannel = Exclude<StreamChannel, "info">;

export interface CommandRequest {
	executable: string;
	args: readonly string[];
	/** The working directory: the project folder or a folder inside it. */
	cwd: string;
	/** Extra environment variables for this run only. */
	env?: Readonly<Record<string, string>>;
	/** Aborting it stops the process; the run then answers with a null exit code. */
	signal: AbortSignal;
	/** Receives the process's output as it arrives, in chunks that need not end at a line break. */
	onOutput?: (channel: CommandOutputChannel, text: string) => void;
}

export interface CommandResult {
	/** The recorded command's id (the `CommandRecord` the run is logged as). */
	commandId: string;
	/** Null when the process ended by a signal (for example, after an abort). */
	exitCode: number | null;
	durationMs: number;
}

export interface CommandRunner {
	run(request: CommandRequest): Promise<CommandResult>;
}
