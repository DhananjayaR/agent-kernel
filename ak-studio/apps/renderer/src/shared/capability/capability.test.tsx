// useCapability against a fake catalog (the real one is empty until P2, pre-flight ruling 10): it answers the
// catalog's status for the provider's version; an id the catalog lacks throws in development and tests, and in a
// production build answers "available" and logs once.
import type {
	CapabilityCatalog,
	CapabilityStatus,
} from "@ak-studio/kernel-catalog";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	CatalogProvider,
	capabilityStatus,
	resetCapabilityLog,
	useCapability,
} from "./capability";

/** A catalog that knows three capabilities, whose status depends only on the version's minor (good enough here). */
const fake: CapabilityCatalog = {
	has: (id) =>
		["framework.maf", "deploy.azure.functions", "config.schedule"].includes(id),
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
