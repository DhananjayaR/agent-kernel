// useCapability against a fake catalog (the real one is empty until P2, pre-flight ruling 10): it answers the
// catalog's status for the provider's version; an id the catalog lacks throws in development and tests, and in a
// production build answers "available" and logs once.
import type {
	CapabilityCatalog,
	CapabilityStatus,
} from "@ak-studio/kernel-catalog";
import { render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	CatalogProvider,
	capabilityGate,
	capabilityStatus,
	resetCapabilityLog,
	useCapability,
	useCapabilityScope,
} from "./capability";

/** A catalog that knows three capabilities, whose status depends only on the version's minor (good enough here). */
const fake: CapabilityCatalog = {
	has: (id) =>
		["framework.maf", "deploy.azure.functions", "config.schedule"].includes(id),
	get: (id) =>
		id === "framework.maf"
			? { id, title: "Microsoft Agent Framework", since: "0.10.0" }
			: id === "deploy.azure.functions"
				? { id, title: "Azure Functions", since: "0.5.0", until: "0.11.0" }
				: undefined,
	status: (id, version): CapabilityStatus => {
		const minor = Number(version.split(".")[1]);
		if (id === "framework.maf")
			return minor >= 10 ? "available" : "needs-upgrade";
		if (id === "deploy.azure.functions")
			return minor >= 11 ? "removed" : "available";
		return "available";
	},
};

function withCatalog(version: string) {
	return ({ children }: { children: ReactNode }) => (
		<CatalogProvider catalog={fake} version={version}>
			{children}
		</CatalogProvider>
	);
}

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
	resetCapabilityLog();
});

describe("useCapability", () => {
	it("answers the catalog's status for the project's version", () => {
		const status = (id: string, version: string) =>
			renderHook(() => useCapability(id), { wrapper: withCatalog(version) })
				.result.current;
		expect(status("framework.maf", "0.10.2")).toBe("available");
		expect(status("framework.maf", "0.9.0")).toBe("needs-upgrade");
		expect(status("deploy.azure.functions", "0.11.0")).toBe("removed");
	});

	it("throws for an id the catalog does not have (development and tests)", () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		expect(() =>
			renderHook(() => useCapability("framework.typo"), {
				wrapper: withCatalog("0.10.2"),
			}),
		).toThrow(
			"capability framework.typo is not in the kernel capability catalog",
		);
	});

	it("throws with no provider: the P1b catalog is empty", () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		expect(() => renderHook(() => useCapability("framework.maf"))).toThrow(
			/not in the kernel capability catalog/,
		);
	});

	it("answers available in a production build, and logs each unknown id once", () => {
		vi.stubEnv("PROD", true);
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const { result, rerender } = renderHook(({ id }) => useCapability(id), {
			wrapper: withCatalog("0.10.2"),
			initialProps: { id: "framework.typo" },
		});
		expect(result.current).toBe("available");
		rerender({ id: "framework.typo" });
		rerender({ id: "config.typo" });
		expect(log.mock.calls.map(([message]) => message)).toEqual([
			"[studio] capability framework.typo is not in the kernel capability catalog; treated as available",
			"[studio] capability config.typo is not in the kernel capability catalog; treated as available",
		]);
	});
});

describe("capabilityStatus", () => {
	it("refuses a known id asked about with no version", () => {
		const log = vi.fn();
		expect(() =>
			capabilityStatus(fake, "framework.maf", undefined, { strict: true, log }),
		).toThrow(/no project version/);
		expect(
			capabilityStatus(fake, "framework.maf", undefined, {
				strict: false,
				log,
			}),
		).toBe("available");
		expect(log).toHaveBeenCalledOnce();
	});
});

describe("capabilityGate", () => {
	it("is available with no capability, and gives the version gate's reason otherwise", () => {
		expect(capabilityGate(undefined)).toEqual({ available: true });
		const old = { catalog: fake, version: "0.9.1" };
		expect(capabilityGate("framework.maf", old)).toEqual({
			available: false,
			status: "needs-upgrade",
			reason: "Needs OAK 0.10.0",
		});
		expect(
			capabilityGate("deploy.azure.functions", {
				catalog: fake,
				version: "0.11.0",
			}),
		).toEqual({
			available: false,
			status: "removed",
			reason: "Removed in OAK 0.11.0",
		});
		expect(
			capabilityGate("framework.maf", { catalog: fake, version: "0.10.2" }),
		).toEqual({ available: true });
	});

	it("gates nothing with no project version, but still throws for an id the catalog lacks", () => {
		expect(
			capabilityGate("framework.maf", { catalog: fake, version: undefined }),
		).toEqual({ available: true });
		expect(() =>
			capabilityGate("framework.typo", { catalog: fake, version: undefined }),
		).toThrow(/not in the kernel capability catalog/);
	});

	it("reads the capability scope, which the mounted CatalogProvider writes and clears", () => {
		const before = useCapabilityScope.getState();
		expect(before.version).toBeUndefined();
		const { unmount } = render(
			<CatalogProvider catalog={fake} version="0.9.0">
				<span />
			</CatalogProvider>,
		);
		expect(useCapabilityScope.getState()).toEqual({
			catalog: fake,
			version: "0.9.0",
		});
		expect(capabilityGate("framework.maf").available).toBe(false);
		unmount();
		expect(useCapabilityScope.getState()).toBe(before);
	});
});
