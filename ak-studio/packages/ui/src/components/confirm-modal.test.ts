// The typed-name rule of a destructive ConfirmModal.
import { describe, expect, it } from "vitest";
import { uiStrings } from "../strings";
import { nameMatches, typeToConfirmLabel } from "./confirm-modal";

describe("typeToConfirmLabel", () => {
	it("puts the name in literally, with no $ pattern expansion", () => {
		const template = uiStrings.confirmModal.typeToConfirm;
		expect(typeToConfirmLabel(template, "triage")).toBe(
			"Type triage to confirm",
		);
		expect(typeToConfirmLabel(template, "$&")).toBe("Type $& to confirm");
		expect(typeToConfirmLabel(template, "a$'b$`c$$")).toBe(
			"Type a$'b$`c$$ to confirm",
		);
	});
});

describe("nameMatches", () => {
	it("needs an exact, non-empty match", () => {
		expect(nameMatches("triage", "triage")).toBe(true);
		expect(nameMatches("Triage", "triage")).toBe(false);
		expect(nameMatches("triage ", "triage")).toBe(false);
		expect(nameMatches("", "")).toBe(false);
		expect(nameMatches("", undefined)).toBe(false);
	});
});
