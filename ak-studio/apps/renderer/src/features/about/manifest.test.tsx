// The About feature's manifest: its id, its temporary tab and route, the screen that route mounts (titled from the
// feature's strings), and its app commands: one starts the demo job through runCommand, one opens the screen.
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bindNavigate } from "../../shared/commands/navigation";
import {
	getCommands,
	runCommand,
	setCommands,
} from "../../shared/commands/runCommand";
import { type ConnectedMock, connectMock } from "../../test/connectedMock";
import { MockApp } from "../../test/MockApp";
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
	it("mounts its screen at /about, titled with the feature's name, saying what About is for", async () => {
		expect(aboutFeature.id).toBe("about");
		const route = aboutFeature.routes?.find((r) => r.path === "/about");
		if (!route) throw new Error("no route at /about");
		const Screen = route.component;
		render(
			<MockApp>
				<Screen />
			</MockApp>,
		);
		expect((await screen.findByRole("heading", { level: 2 })).textContent).toBe(
			aboutStrings.title,
		);
		expect(screen.getByText(aboutStrings.intro)).toBeTruthy();
	});

	it("has a temporary tab, the last one, removed with the feature", () => {
		expect(aboutFeature.tab).toEqual({
			label: "About",
			path: "/about",
			order: 6,
		});
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

	it("offers about.show, which opens the About screen once a shell can navigate", async () => {
		const command = aboutFeature.commands.find((c) => c.id === "about.show");
		expect(command?.title).toBe("Open About");
		setCommands(aboutFeature.commands);
		const navigate = vi.fn();
		// No shell: hidden, and running it does nothing.
		expect(command?.when?.()).toBe(false);
		await runCommand("about.show");
		const unbind = bindNavigate(navigate);
		await runCommand("about.show");
		unbind();
		expect(navigate).toHaveBeenCalledExactlyOnceWith("/about");
	});
});
