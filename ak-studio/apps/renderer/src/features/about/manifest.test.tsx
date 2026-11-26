// The About feature's manifest: its id and route, the screen that route mounts (the empty state, titled from the
// feature's strings), and its app command, which starts the demo job through runCommand.
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
	getCommands,
	runCommand,
	setCommands,
} from "../../shared/commands/runCommand";
import { type ConnectedMock, connectMock } from "../../test/connectedMock";
import { aboutFeature } from "./manifest";
import { aboutStrings } from "./strings";

let mock: ConnectedMock | undefined;
const appCommands = getCommands();
afterEach(() => {
	setCommands(appCommands);
	mock?.dispose();
	mock = undefined;
});

describe("aboutFeature", () => {
	it("mounts its screen at /about, titled with the feature's name, saying what About is for", () => {
		expect(aboutFeature.id).toBe("about");
		const route = aboutFeature.routes?.find((r) => r.path === "/about");
		if (!route) throw new Error("no route at /about");
		const Screen = route.component;
		render(<Screen />);
		expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
			aboutStrings.title,
		);
		expect(screen.getByText(aboutStrings.empty.description)).toBeTruthy();
	});

	it("offers about.runDemoJob, with a title and no shortcut, which starts the demo job", async () => {
		const command = aboutFeature.commands.find(
			(c) => c.id === "about.runDemoJob",
		);
		expect(command?.title).toBe("Run the demo job");
		expect(command?.shortcut).toBeUndefined();
		mock = connectMock();
		setCommands(aboutFeature.commands);
		await runCommand("about.runDemoJob");
		const jobs = mock.backend.jobs.list();
		expect(jobs.map((job) => job.kind)).toEqual(["about.demoJob"]);
		await mock.backend.jobs.cancelAll(jobs);
		await waitFor(() =>
			expect(mock?.backend.jobs.list()[0]?.state).toBe("cancelled"),
		);
	});
});
