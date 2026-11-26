// SchemaForm (P1b skeleton, D12): fields from the schema, set versus default visible, strict integers (typed
// digits become a number; "30" already in the config as a string is rejected), required, enum, Optional
// sections, and the per-field override map.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import fieldKinds from "./fixtures/field-kinds.schema.json";
import validateFieldKinds from "./fixtures/field-kinds.validate.js";
import session from "./fixtures/session.schema.json";
import validateSession from "./fixtures/session.validate.js";
import { type FieldControlProps, SchemaForm } from "./SchemaForm";
import type { JsonSchema } from "./schema";
import { formStrings } from "./strings";

const sessionSchema = session as JsonSchema;
const kindsSchema = fieldKinds as JsonSchema;

function renderSession(
	value: Record<string, unknown>,
	overrides?: Parameters<typeof SchemaForm>[0]["overrides"],
) {
	const onSubmit = vi.fn();
	render(
		<SchemaForm
			schema={sessionSchema}
			validate={validateSession}
			value={value}
			onSubmit={onSubmit}
			overrides={overrides}
		/>,
	);
	return { onSubmit, user: userEvent.setup() };
}

/** An override for `type`: a button that picks "valkey" and shows the current value. */
function TypePicker({ value, onChange }: FieldControlProps) {
	return (
		<button type="button" onClick={() => onChange("valkey")}>
			{`picked ${String(value ?? "nothing")}`}
		</button>
	);
}

const save = () => screen.getByRole("button", { name: formStrings.save });

describe("SchemaForm", () => {
	it("shows a set value as the value and an unset one's default as the placeholder", () => {
		renderSession({ type: "redis" });
		expect(screen.getByRole("textbox", { name: "type" })).toHaveProperty(
			"value",
			"redis",
		);
		const ttl = screen.getByRole("textbox", { name: "ttl" });
		expect(ttl).toHaveProperty("value", "");
		expect(ttl.getAttribute("placeholder")).toBe(
			formStrings.defaultHint("86400"),
		);
	});

	it("converts typed digits in an integer field to a number", async () => {
		const { onSubmit, user } = renderSession({ cache: {} });
		await user.type(screen.getByRole("textbox", { name: "size" }), "30");
		await user.click(save());
		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		expect(onSubmit.mock.calls[0]?.[0]).toEqual({ cache: { size: 30 } });
	});

	it("is strict: '30' as a string in the config is rejected for an integer, not coerced", async () => {
		const { onSubmit, user } = renderSession({ cache: { size: "30" } });
		await user.click(save());
		expect(await screen.findByText(formStrings.errors.integer)).toBeTruthy();
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("keeps non-numeric text in an integer field as text, which fails", async () => {
		const { onSubmit, user } = renderSession({ cache: {} });
		await user.type(screen.getByRole("textbox", { name: "size" }), "3x");
		await user.tab();
		expect(await screen.findByText(formStrings.errors.integer)).toBeTruthy();
		await user.click(save());
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("reports a required field on the field", async () => {
		const { onSubmit, user } = renderSession({ dynamodb: { ttl: 60 } });
		await user.click(save());
		const tableName = screen.getAllByRole("textbox", {
			name: "table_name",
		})[0] as HTMLElement;
		await waitFor(() =>
			expect(tableName.getAttribute("aria-invalid")).toBe("true"),
		);
		expect(screen.getByText(formStrings.errors.required)).toBeTruthy();
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("turns an Optional section on and off", async () => {
		const { onSubmit, user } = renderSession({});
		expect(screen.queryByRole("textbox", { name: "size" })).toBeNull();
		await user.click(
			screen.getByRole("switch", {
				name: formStrings.configureSection("cache"),
			}),
		);
		await user.type(screen.getByRole("textbox", { name: "size" }), "8");
		await user.click(save());
		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ cache: { size: 8 } });

		await user.click(
			screen.getByRole("switch", {
				name: formStrings.configureSection("cache"),
			}),
		);
		await user.click(save());
		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
		expect(onSubmit.mock.calls[1]?.[0]).not.toHaveProperty("cache");
	});

	it("turns off an Optional section that was set in the config, leaving it out", async () => {
		const { onSubmit, user } = renderSession({ cache: { size: 5 } });
		expect(screen.getByRole("textbox", { name: "size" })).toHaveProperty(
			"value",
			"5",
		);
		await user.click(
			screen.getByRole("switch", {
				name: formStrings.configureSection("cache"),
			}),
		);
		expect(screen.queryByRole("textbox", { name: "size" })).toBeNull();
		await user.click(save());
		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		expect(onSubmit.mock.calls[0]?.[0]).not.toHaveProperty("cache");
	});

	it("renders an enum as a picker of its values and a boolean as a switch", async () => {
		const onSubmit = vi.fn();
		const user = userEvent.setup();
		render(
			<SchemaForm
				schema={kindsSchema}
				validate={validateFieldKinds}
				value={{ name: "n" }}
				onSubmit={onSubmit}
			/>,
		);
		await user.click(screen.getByRole("button", { name: /mode/ }));
		expect(
			screen.getAllByRole("option").map((o) => o.textContent?.trim()),
		).toEqual(["fast", "thorough"]);
		await user.click(screen.getByRole("option", { name: "thorough" }));
		await user.click(screen.getByRole("switch", { name: "enabled" }));
		await user.click(save());
		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		expect(onSubmit.mock.calls[0]?.[0]).toEqual({
			name: "n",
			mode: "thorough",
			enabled: true,
		});
	});

	it("rejects an enum value outside the list that came from the config", async () => {
		const onSubmit = vi.fn();
		const user = userEvent.setup();
		render(
			<SchemaForm
				schema={kindsSchema}
				validate={validateFieldKinds}
				value={{ name: "n", mode: "slow" }}
				onSubmit={onSubmit}
			/>,
		);
		await user.click(save());
		expect(await screen.findByText(formStrings.errors.enum)).toBeTruthy();
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("replaces one field's control from the override map, and only that one", async () => {
		const { onSubmit, user } = renderSession(
			{ type: "redis" },
			{ type: TypePicker },
		);
		expect(screen.queryByRole("textbox", { name: "type" })).toBeNull();
		expect(screen.getAllByRole("textbox", { name: "ttl" })).toHaveLength(1);
		await user.click(screen.getByRole("button", { name: "picked redis" }));
		await user.click(save());
		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		expect(onSubmit.mock.calls[0]?.[0]).toEqual({ type: "valkey" });
	});
});
