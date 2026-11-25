// The read-only Select finds the selected option's text by the same key rule React Aria uses for collections.
import { createElement, Fragment } from "react";
import { describe, expect, it } from "vitest";
import { collectionItemText } from "./collection";

type Option = { children: string; id?: string; textValue?: string };
const option = (props: Option) => createElement("option", props);

describe("collectionItemText", () => {
	it("finds a static item by its id", () => {
		const children = createElement(
			Fragment,
			null,
			option({ id: "redis", children: "Redis" }),
			option({ id: "dynamodb", children: "DynamoDB" }),
		).props.children;
		expect(collectionItemText(children, undefined, "dynamodb")).toBe(
			"DynamoDB",
		);
	});

	it("keys items by the element's id, then the data's key, then its id", () => {
		const items = [
			{ id: "redis", name: "Redis" },
			{ key: "dynamodb", id: "ignored", name: "DynamoDB" },
			{ id: "cosmos", name: "Cosmos DB" },
		];
		const render = (item: (typeof items)[number]) =>
			option({ children: item.name });
		expect(collectionItemText(render, items, "redis")).toBe("Redis");
		expect(collectionItemText(render, items, "dynamodb")).toBe("DynamoDB");
		expect(collectionItemText(render, items, "ignored")).toBeUndefined();
		const explicit = (item: (typeof items)[number]) =>
			option({ id: `x-${item.name}`, children: item.name });
		expect(collectionItemText(explicit, items, "x-Cosmos DB")).toBe(
			"Cosmos DB",
		);
		expect(collectionItemText(explicit, items, "cosmos")).toBeUndefined();
	});

	it("falls back to textValue when the children are not a string", () => {
		const children = createElement(
			"option",
			{ id: "a", textValue: "Alpha" },
			createElement("b", null, "Alpha"),
		);
		expect(collectionItemText(children, undefined, "a")).toBe("Alpha");
	});

	it("returns undefined for no key or no match", () => {
		const children = option({ id: "a", children: "Alpha" });
		expect(collectionItemText(children, undefined, null)).toBeUndefined();
		expect(collectionItemText(children, undefined, "b")).toBeUndefined();
	});
});
