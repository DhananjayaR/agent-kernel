// ProjectScopes tests: open, get, require (project.notOpen once closed), and a scope's disposal: disposers run
// in reverse order, once, even when one fails.
import { ERROR_CODES, StudioFailure } from "@ak-studio/contract";
import { describe, expect, it, vi } from "vitest";
import { ProjectScopes } from "./scope";
import { SecretMasker } from "./secrets";

describe("ProjectScopes", () => {
	it("opens a scope with its project id and root, and finds it again", () => {
		const scopes = new ProjectScopes();
		const scope = scopes.open("p1", { root: "/work/p1" });
		expect(scope.projectId).toBe("p1");
		expect(scope.root).toBe("/work/p1");
		expect(scopes.get("p1")).toBe(scope);
		expect(scopes.require("p1")).toBe(scope);
		expect(scopes.get("p2")).toBeUndefined();
	});

	it("refuses to open a project that is already open", () => {
		const scopes = new ProjectScopes();
		scopes.open("p1", { root: "/work/p1" });
		expect(() => scopes.open("p1", { root: "/work/p1" })).toThrow(
			/already open/,
		);
	});

	it("require throws project.notOpen for a project never opened, and after close", async () => {
		const scopes = new ProjectScopes();
		const notOpen = (fn: () => unknown) => {
			try {
				fn();
			} catch (err) {
				expect(err).toBeInstanceOf(StudioFailure);
				expect((err as StudioFailure).error.code).toBe(
					ERROR_CODES.projectNotOpen,
				);
				return;
			}
			throw new Error("expected project.notOpen");
		};
		notOpen(() => scopes.require("p1"));
		scopes.open("p1", { root: "/work/p1" });
		await scopes.close("p1");
		notOpen(() => scopes.require("p1"));
		expect(scopes.get("p1")).toBeUndefined();
	});

	it("runs disposers in reverse order, and only once", async () => {
		const scopes = new ProjectScopes();
		const scope = scopes.open("p1", { root: "/work/p1" });
		const order: string[] = [];
		scope.onDispose(() => {
			order.push("first");
		});
		scope.onDispose(async () => {
			await Promise.resolve();
			order.push("second");
		});
		scope.onDispose(() => {
			order.push("third");
		});
		await Promise.all([scope.dispose(), scope.dispose()]);
		await scope.dispose();
		expect(order).toEqual(["third", "second", "first"]);
		expect(scope.disposed).toBe(true);
	});

	it("waits for each disposer before the next", async () => {
		const scope = new ProjectScopes().open("p1", { root: "/r" });
		const order: string[] = [];
		let release: () => void = () => {};
		scope.onDispose(() => {
			order.push("earlier");
		});
		scope.onDispose(
			() =>
				new Promise<void>((resolve) => {
					release = () => {
						order.push("later done");
						resolve();
					};
				}),
		);
		const done = scope.dispose();
		await Promise.resolve();
		expect(order).toEqual([]);
		release();
		await done;
		expect(order).toEqual(["later done", "earlier"]);
	});

	it("keeps disposing when a disposer fails, and logs the failure", async () => {
		const log = vi.fn();
		const scope = new ProjectScopes({ log }).open("p1", { root: "/r" });
		const ran = vi.fn();
		scope.onDispose(ran);
		scope.onDispose(() => {
			throw new Error("stuck");
		});
		await expect(scope.dispose()).resolves.toBeUndefined();
		expect(ran).toHaveBeenCalledOnce();
		expect(log).toHaveBeenCalledWith(expect.stringMatching(/p1.*stuck/));
	});

	it("masks known secrets in the line it logs for a failing disposer", async () => {
		const log = vi.fn();
		const masker = new SecretMasker();
		masker.add("hunter22");
		const scope = new ProjectScopes({ log, masker }).open("p1", { root: "/r" });
		scope.onDispose(() => {
			throw new Error("could not stop hunter22");
		});
		await scope.dispose();
		expect(log).toHaveBeenCalledWith(
			expect.stringContaining("could not stop ••••"),
		);
	});

	it("unregisters a disposer with the function onDispose returns", async () => {
		const scope = new ProjectScopes().open("p1", { root: "/r" });
		const gone = vi.fn();
		const off = scope.onDispose(gone);
		off();
		await scope.dispose();
		expect(gone).not.toHaveBeenCalled();
	});

	it("runs a disposer added after disposal at once", async () => {
		const scope = new ProjectScopes().open("p1", { root: "/r" });
		await scope.dispose();
		const late = vi.fn();
		scope.onDispose(late);
		await Promise.resolve();
		expect(late).toHaveBeenCalledOnce();
	});

	it("close disposes one scope; closing an unknown project does nothing", async () => {
		const scopes = new ProjectScopes();
		const a = scopes.open("a", { root: "/a" });
		const b = scopes.open("b", { root: "/b" });
		await scopes.close("a");
		await scopes.close("nope");
		expect(a.disposed).toBe(true);
		expect(b.disposed).toBe(false);
		expect(scopes.get("b")).toBe(b);
	});

	it("closeAll disposes every scope, newest first, and lets a project open again", async () => {
		const scopes = new ProjectScopes();
		const order: string[] = [];
		for (const id of ["a", "b", "c"]) {
			scopes.open(id, { root: `/${id}` }).onDispose(() => {
				order.push(id);
			});
		}
		await scopes.closeAll();
		expect(order).toEqual(["c", "b", "a"]);
		expect(scopes.get("a")).toBeUndefined();
		expect(scopes.open("a", { root: "/a" }).disposed).toBe(false);
	});
});
