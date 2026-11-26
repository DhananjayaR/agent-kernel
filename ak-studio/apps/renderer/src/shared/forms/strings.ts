// The copy for generated config forms (SchemaForm), in one place (copy rules: sentence case, OAK's words; an
// error says what happened, then what to do). Field labels are the config keys themselves, as written in
// config.yaml, so they are not here.
export const formStrings = {
	save: "Save",
	/** Placeholder or hint of a field that is not set: the value OAK uses instead. */
	defaultHint: (value: string) => `Default: ${value}`,
	/** Placeholder of a field that is not set and has no default value (OAK leaves it empty). */
	notSet: "Not set",
	booleanText: { on: "on", off: "off" },
	/** The switch that adds an Optional section (off: the section is left out of the config). */
	configureSection: (key: string) => `Configure ${key}`,
	unsupported:
		"This setting cannot be edited in this form yet. Edit it in config.yaml.",
	errors: {
		required: "This setting is required. Enter a value.",
		integer: "This is not a whole number. Enter digits only.",
		number:
			"This is not a number. Enter digits, with a decimal point if needed.",
		string: "This is not text. Enter a text value.",
		boolean: "This is not on or off. Choose on or off.",
		enum: "This is not one of the allowed values. Choose one from the list.",
		invalid: "This value is not accepted. Check the help text and change it.",
	},
} as const;
