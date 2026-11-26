// Running an app command where no view will show its failure: the command palette, a shortcut, a toast's "Show", an
// error's next action (ErrorView). A rejection, a synchronous throw (an unknown id in development) or a
// version-gated refusal goes to the bound reporter: the Shell binds patterns/failureNotice.ts's reportCommandFailure
// (a toast). Unbound (tests, Storybook), it is logged. It lives with the commands, so the commands never import the
// patterns.
import { runCommand } from "./runCommand";

type Reporter = (commandId: string, error: unknown) => void;

const logOnly: Reporter = (commandId, error) => {
	console.error(
		`[studio] command ${commandId} failed: ${error instanceof Error ? error.message : String(error)}`,
	);
};

let reporter: Reporter = logOnly;

/** Binds how a failed command is reported; returns the unbind. The Shell calls it while it is mounted. */
export function bindCommandFailureReporter(report: Reporter): () => void {
	reporter = report;
	return () => {
		if (reporter === report) reporter = logOnly;
	};
}

/** Runs `commandId` (with `args`, when given); any failure is reported, never thrown. */
export function runReported(commandId: string, args?: unknown): void {
	try {
		runCommand(commandId, args).catch((error: unknown) =>
			reporter(commandId, error),
		);
	} catch (error) {
		reporter(commandId, error);
	}
}
