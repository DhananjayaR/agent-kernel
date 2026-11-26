// The version gate over useCapability: an available capability renders its children as they are; one the project's
// version is too old for renders the version notice at its size (a tab's empty state, a section's banner over its
// fields made read-only, one control kept in place with its tag and a popover), with the version, the upgrade command
// from the CatalogProvider (copied, never run) and the docs opener; a removed one names its replacement.
import type { CapabilityCatalog } from "@ak-studio/kernel-catalog";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogProvider } from "../capability/capability";
import { CapabilityGate, CapabilityTag } from "./CapabilityGate";
import { bindFailureNotice } from "./failureNotice";

afterEach(() => {
	vi.restoreAllMocks();
});

/** `deploy.azure` from OAK 0.12.0; `store.legacy` removed in 0.14.0, replaced by `store.redis`. */
const catalog: CapabilityCatalog = {
	has: (id) => ["deploy.azure", "store.legacy", "store.redis"].includes(id),
	get: (id) =>
		({
			"deploy.azure": {
				id,
				title: "Azure Functions deploy",
				since: "0.12.0",
				docs: "https://docs.example/deploy/azure",
			},
			"store.legacy": {
				id,
				title: "Legacy session store",
				since: "0.8.0",
				until: "0.14.0",
				replacedBy: "store.redis",
			},
			"store.redis": { id, title: "Redis session store", since: "0.9.0" },
		})[id],
	status: (id, version) => {
		const minor = Number(version.split(".")[1]);
		if (id === "deploy.azure")
			return minor >= 12 ? "available" : "needs-upgrade";
		if (id === "store.legacy") return minor >= 14 ? "removed" : "available";
		return "available";
	},
};

function stubClipboard(writeText: (text: string) => Promise<void>) {
	Object.defineProperty(navigator, "clipboard", {
		value: { writeText },
		configurable: true,
	});
}

const upgradeCommand = (since: string) =>
	`uv add "agentkernel[openai]>=${since}"`;

function inProject(version: string, ui: React.ReactNode, openDocs = vi.fn()) {
	return render(
		<CatalogProvider
			catalog={catalog}
			version={version}
			upgradeCommand={upgradeCommand}
			openDocs={openDocs}
		>
			{ui}
		</CatalogProvider>,
	);
}

describe("CapabilityGate", () => {
	it("renders the children as they are when the project's version has the capability", () => {
		inProject(
			"0.12.1",
			<>
				<CapabilityGate id="deploy.azure" size="tab">
					<p>Deploy settings</p>
				</CapabilityGate>
				<CapabilityGate id="deploy.azure" size="section">
					{({ readOnly }) => <p>{readOnly ? "read-only" : "editable"}</p>}
				</CapabilityGate>
				<CapabilityTag id="deploy.azure" />
			</>,
		);
		expect(screen.getByText("Deploy settings")).toBeTruthy();
		expect(screen.getByText("editable")).toBeTruthy();
		expect(document.querySelector("[data-slot=version-tag]")).toBeNull();
	});

	it("shows a tab's notice: the version needed, the project's, the command to copy and the docs", async () => {
		const openDocs = vi.fn();
		// After userEvent.setup, which puts its own clipboard on the navigator.
		const user = userEvent.setup();
		const writeText = vi.fn(async (_text: string) => {});
		stubClipboard(writeText);
		inProject(
			"0.10.2",
			<CapabilityGate id="deploy.azure" size="tab">
				<p>Deploy settings</p>
			</CapabilityGate>,
			openDocs,
		);
		expect(screen.queryByText("Deploy settings")).toBeNull();
		expect(
			screen.getByRole("heading", {
				name: "Azure Functions deploy needs OAK 0.12.0 or later",
			}),
		).toBeTruthy();
		const notice = document.querySelector(
			"[data-slot=version-notice]",
		) as HTMLElement;
		expect(notice.textContent).toContain("This project uses OAK 0.10.2.");
		const command = 'uv add "agentkernel[openai]>=0.12.0"';
		expect(within(notice).getByText(command)).toBeTruthy();
		await user.click(within(notice).getByRole("button", { name: "Copy code" }));
		expect(writeText).toHaveBeenCalledWith(command);
		await user.click(
			within(notice).getByRole("button", { name: "Open the docs" }),
		);
		expect(openDocs).toHaveBeenCalledWith("https://docs.example/deploy/azure");
	});

	it("reports a Copy the clipboard refuses", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const notify = vi.fn();
		const unbind = bindFailureNotice(notify);
		const user = userEvent.setup();
		stubClipboard(() => Promise.reject(new Error("denied")));
		inProject(
			"0.10.2",
			<CapabilityGate id="deploy.azure" size="tab">
				x
			</CapabilityGate>,
		);
		await user.click(screen.getByRole("button", { name: "Copy code" }));
		await vi.waitFor(() =>
			expect(notify).toHaveBeenCalledWith(
				expect.objectContaining({
					title: "The upgrade command could not be copied",
				}),
			),
		);
		unbind();
	});

	it("shows a section's banner over its fields, rendered read-only, and the tag in the section list", () => {
		inProject(
			"0.10.2",
			<>
				<CapabilityTag id="deploy.azure" />
				<CapabilityGate id="deploy.azure" size="section">
					{({ readOnly }) => <p>{readOnly ? "read-only" : "editable"}</p>}
				</CapabilityGate>
			</>,
		);
		expect(document.querySelector("[data-slot=version-tag]")?.textContent).toBe(
			"Needs 0.12.0",
		);
		const banner = document.querySelector(
			"[data-slot=version-notice]",
		) as HTMLElement;
		expect(banner.dataset.tone).toBe("info");
		expect(banner.textContent).toContain(
			"The fields below are read-only until then.",
		);
		expect(screen.getByText("read-only")).toBeTruthy();
	});

	it("keeps one control in place with its tag; pressing it opens the popover and runs nothing", async () => {
		const run = vi.fn();
		const user = userEvent.setup();
		inProject(
			"0.10.2",
			<CapabilityGate id="deploy.azure" size="control" label="Azure Functions">
				<button type="button" onClick={run}>
					Azure Functions
				</button>
			</CapabilityGate>,
		);
		const control = screen.getByRole("button", { name: /Azure Functions/ });
		expect(control.textContent).toContain("Needs 0.12.0");
		await user.click(control);
		const popover = await screen.findByRole("dialog", {
			name: "Azure Functions deploy needs OAK 0.12.0 or later",
		});
		expect(popover.textContent).toContain(
			'uv add "agentkernel[openai]>=0.12.0"',
		);
		expect(run).not.toHaveBeenCalled();
	});

	it("says a removed capability's version and its replacement, with no upgrade command", () => {
		inProject(
			"0.14.1",
			<CapabilityGate id="store.legacy" size="tab">
				<p>Session store</p>
			</CapabilityGate>,
		);
		expect(
			screen.getByRole("heading", {
				name: "Legacy session store was removed in OAK 0.14.0",
			}),
		).toBeTruthy();
		const notice = document.querySelector(
			"[data-slot=version-notice]",
		) as HTMLElement;
		expect(notice.textContent).toContain("Use Redis session store instead.");
		expect(notice.querySelector("[data-slot=code-block]")).toBeNull();
	});

	it("without P2's command and docs opener, still says to upgrade", () => {
		render(
			<CatalogProvider catalog={catalog} version="0.10.2">
				<CapabilityGate id="deploy.azure" size="tab">
					x
				</CapabilityGate>
			</CatalogProvider>,
		);
		const notice = document.querySelector(
			"[data-slot=version-notice]",
		) as HTMLElement;
		expect(notice.textContent).toContain(
			"Upgrade OAK in this project to use it.",
		);
		expect(within(notice).queryByRole("button")).toBeNull();
	});
});
