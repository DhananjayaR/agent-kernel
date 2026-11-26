// SecretMasker tests: known values (4 characters or more) become "••••" wherever they appear, overlapping values
// mask fully, and a removed value is shown again.
import { describe, expect, it } from "vitest";
import { MASK, SecretMasker } from "./secrets";

describe("SecretMasker", () => {
	it("masks every occurrence of each known value", () => {
		const masker = new SecretMasker();
		masker.add("hunter22");
		masker.add("s3cr3t");
		expect(masker.mask("pw=hunter22 again hunter22, key s3cr3t.")).toBe(
			"pw=•••• again ••••, key ••••.",
		);
		expect(MASK).toBe("••••");
	});

	it("leaves text alone when nothing is known, and returns empty text as is", () => {
		const masker = new SecretMasker();
		expect(masker.mask("nothing to hide")).toBe("nothing to hide");
		masker.add("abcd");
		expect(masker.mask("")).toBe("");
	});

	it("ignores values shorter than 4 characters", () => {
		const masker = new SecretMasker();
		masker.add("abc");
		masker.add("");
		expect(masker.mask("abc abcd")).toBe("abc abcd");
	});

	it("masks a value that contains another value fully (longest first)", () => {
		const masker = new SecretMasker();
		masker.add("abcd");
		masker.add("xxabcdyy");
		expect(masker.mask("[xxabcdyy] [abcd]")).toBe("[••••] [••••]");
	});

	it("masks two values that overlap in the text as one span", () => {
		const masker = new SecretMasker();
		masker.add("abcdef");
		masker.add("efghij");
		expect(masker.mask("<abcdefghij>")).toBe("<••••>");
	});

	it("matches values literally, not as patterns", () => {
		const masker = new SecretMasker();
		masker.add("a.b*c+(d)");
		expect(masker.mask("a.b*c+(d) aXbbbc(d)")).toBe("•••• aXbbbc(d)");
	});

	it("shows a value again once removed", () => {
		const masker = new SecretMasker();
		masker.add("hunter22");
		masker.remove("hunter22");
		masker.remove("never-added");
		expect(masker.mask("hunter22")).toBe("hunter22");
	});

	it("masks a StudioError's message, detail, file and action label, and keeps the rest", () => {
		const masker = new SecretMasker();
		masker.add("hunter22");
		const error = {
			code: "job.notFound",
			message: "pw hunter22",
			detail: "raw hunter22",
			file: "keys/hunter22.txt",
			line: 3,
			action: {
				label: "Rotate hunter22",
				commandId: "secrets.rotate",
				args: { n: 1 },
			},
		};
		expect(masker.maskError(error)).toEqual({
			code: "job.notFound",
			message: "pw ••••",
			detail: "raw ••••",
			file: "keys/••••.txt",
			line: 3,
			action: {
				label: "Rotate ••••",
				commandId: "secrets.rotate",
				args: { n: 1 },
			},
		});
		expect(error.message).toBe("pw hunter22"); // a copy, not changed in place
		expect(masker.maskError({ code: "c", message: "m" })).toEqual({
			code: "c",
			message: "m",
		});
	});
});
