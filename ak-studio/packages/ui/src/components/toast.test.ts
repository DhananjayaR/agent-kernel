// The toast timing rule (WCAG 2.2.1): a toast with an action stays until dismissed; one without closes after
// TOAST_TIMEOUT_MS. At most three show at once.
import { describe, expect, it } from "vitest";
import {
	createToastQueue,
	notifyBackgroundResult,
	TOAST_TIMEOUT_MS,
} from "./toast";

describe("notifyBackgroundResult", () => {
	it("sets a timeout only when the toast has no action", () => {
		const queue = createToastQueue();
		notifyBackgroundResult(queue, {
			tone: "info",
			title: "Environment synced",
		});
		notifyBackgroundResult(queue, {
			tone: "success",
			title: "Tests passed",
			action: { label: "Show", onAction: () => {} },
		});
		const [withAction, plain] = queue.visibleToasts;
		expect(withAction?.content.title).toBe("Tests passed");
		expect(withAction?.timeout).toBeUndefined();
		expect(plain?.timeout).toBe(TOAST_TIMEOUT_MS);
		expect(TOAST_TIMEOUT_MS).toBeGreaterThanOrEqual(5000);
		queue.clear();
	});

	it("shows at most three toasts at once", () => {
		const queue = createToastQueue();
		for (let i = 0; i < 5; i += 1)
			notifyBackgroundResult(queue, { tone: "info", title: `Result ${i}` });
		expect(queue.visibleToasts).toHaveLength(3);
		queue.clear();
	});
});
