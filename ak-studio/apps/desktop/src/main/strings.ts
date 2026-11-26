// The main process's user-facing copy, in one place (the copy rules: sentence case, OAK's words, what happened
// and then what to do): the native quit and unload dialogs (P1b ruling 11), shown by index.ts and built in
// quit.ts. The services' error messages live with the runtime's strings.

const plural = (n: number, one: string, many: string) =>
	n === 1 ? `1 ${one}` : `${n} ${many}`;
const bullets = (titles: readonly string[]) =>
	titles.map((title) => `• ${title}`).join("\n");

export const dialogStrings = {
	quitUnsaved: {
		message: "Quit without saving?",
		detail: (items: readonly string[]) =>
			`Unsaved changes in:\n${bullets(items)}`,
		quit: "Quit without saving",
		stay: "Stay",
	},
	cancelJobs: {
		message: (count: number) =>
			`Quit and cancel ${plural(count, "job", "jobs")}?`,
		detail: (titles: readonly string[]) =>
			`${titles.length === 1 ? "This job" : "These jobs"} will be cancelled:\n${bullets(titles)}`,
		confirm: "Cancel jobs and quit",
		keep: "Keep working",
	},
	finishJobs: {
		// Wait only keeps the app open: nothing quits by itself once the job has finished.
		message: (count: number) =>
			`${plural(count, "job", "jobs")} must finish before the app can quit`,
		detail: (titles: readonly string[], others: number) => {
			const one = titles.length === 1;
			const parts = [
				`Still running:\n${bullets(titles)}`,
				`Quit anyway stops ${one ? "it" : "them"} partway. That can damage what ${one ? "it was" : "they were"} changing, such as a Terraform state file, and you may have to repair it by hand.`,
			];
			if (others > 0)
				parts.push(
					`Quitting also cancels ${plural(others, "other job", "other jobs")}.`,
				);
			return parts.join("\n\n");
		},
		wait: "Wait",
		quitAnyway: "Quit anyway",
	},
	unsaved: {
		message: "Leave without saving?",
		detail: "You have unsaved changes.",
		leave: "Leave",
		stay: "Stay",
	},
} as const;
