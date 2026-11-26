// Fixture answers for the operations of desktop-only feature services (apps/desktop/src/main/services, the ones
// that need Node or Electron): the browser's mock transport serves these in their place, so it serves every
// operation the app serves (P1b-plan ruling 9). `pnpm new:operation --desktop` adds an answer here with each
// operation; the answer is fixture data, never a call to Node. A project-scoped one checks the mock's project
// scopes, as the desktop service does. `app.*` and `window.*` keep theirs in mockTransport.ts.
import type {
	HandlerInputOf,
	HandlerResultOf,
	OperationName,
	Operations,
} from "@ak-studio/contract";
import type { ProjectScopes } from "@ak-studio/runtime";

/** What a fixture answer may use from the mock: its project scopes. */
export interface FixtureDeps {
	scopes: ProjectScopes;
}

/** A fixture answer for some operations, typed from the contract. */
export type FixtureHandlers = {
	[N in OperationName]?: (
		input: HandlerInputOf<Operations[N]>,
		deps: FixtureDeps,
	) => HandlerResultOf<Operations[N]> | Promise<HandlerResultOf<Operations[N]>>;
};

export const desktopFixtureHandlers: FixtureHandlers = {};
