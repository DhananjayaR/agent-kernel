// The About feature's screen, mounted at /about (manifest.ts) and reached from its temporary tab or the palette
// ("Open About"). A demonstration of the Studio's building blocks, built only from the shared patterns, one section
// per shape:
//
// - **This app** (a query): `about.info`'s version and platform; a skeleton while it reads, ErrorView if it fails.
// - **Note** (a command with a revision): a working copy of `about.note` (useWorkingCopy) written by `about.setNote`;
//   ChangedOnDisk when the note changed under the edits (Keep mine, Take theirs); UnsavedChangesGuard while it is
//   dirty (leaving the tab asks; the label reaches main's quit dialog). "Change it elsewhere" writes the note as
//   another window would, so the stale-write banner can be seen (one window has no second writer otherwise).
// - **Jobs** (a job): "Run the demo job", then JobProgress for the demo jobs in the job store (the live ones and
//   the newest that ended), with the question as the inline approval, and the newest job's output in a
//   StreamingList. Read from the store by kind, never from the id `start` answered, so a job started from the
//   palette, or one a reload reattached to, shows too.
// - **Ticker** (a session): SessionControl over `about.ticker`, with a switch for the 10,000-line burst, and its
//   output in a StreamingList.
//
// InterruptedJobs heads the screen: a demo job an earlier run left unfinished (the app was killed) shows there until
// dismissed.
import type { Job, JobId, StudioError } from "@ak-studio/contract";
import {
	Button,
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
	Skeleton,
	Switch,
	Textarea,
} from "@ak-studio/ui";
import { type ReactNode, useId, useState } from "react";
import { useJobStore } from "../../../shared/jobs/jobStore";
import { ChangedOnDisk } from "../../../shared/patterns/ChangedOnDisk";
import { ErrorView } from "../../../shared/patterns/ErrorView";
import { InterruptedJobs } from "../../../shared/patterns/InterruptedJobs";
import { JobProgressList } from "../../../shared/patterns/JobProgress";
import { failureOf } from "../../../shared/patterns/presentError";
import { SessionControl } from "../../../shared/patterns/SessionControl";
import { StreamingList } from "../../../shared/patterns/StreamingList";
import { UnsavedChangesGuard } from "../../../shared/patterns/UnsavedChangesGuard";
import { requestStudio } from "../../../shared/query/hooks";
import { usePendingAfter } from "../../../shared/query/pending";
import { useSession } from "../../../shared/sessions/sessionStore";
import { useWorkingCopy } from "../../../shared/working-copy/useWorkingCopy";
import { useAboutDemoJob } from "../api/useAboutDemoJob";
import { useAboutInfo } from "../api/useAboutInfo";
import { useAboutNote } from "../api/useAboutNote";
import { useAboutSetNote } from "../api/useAboutSetNote";
import { aboutStrings } from "../strings";

const DEMO_JOB = "about.demoJob";
const TICKER = "about.ticker";
/** The burst the switch asks for: the spec's 10,000-line check. */
const BURST_LINES = 10_000;
const DEMO_KINDS = [DEMO_JOB] as const;

const ACTIVE: ReadonlySet<Job["state"]> = new Set([
	"queued",
	"running",
	"waiting-for-user",
]);

export function AboutScreen() {
	return (
		<div className="relative h-full overflow-auto">
			<div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
				{/* A div, not a <header>: the shell's top bar is the window's one banner landmark. */}
				<div className="flex flex-col gap-1">
					<h2 className="font-heading text-ui-xl font-bold text-text">
						{aboutStrings.title}
					</h2>
					<p className="text-ui text-text-muted">{aboutStrings.intro}</p>
				</div>
				<InterruptedJobs kinds={DEMO_KINDS} />
				<InfoSection />
				<NoteSection />
				<DemoJobSection />
				<TickerSection />
			</div>
		</div>
	);
}

function Section({
	heading,
	description,
	busy,
	children,
}: {
	heading: string;
	description?: string;
	busy?: boolean;
	children: ReactNode;
}) {
	const id = useId();
	return (
		<section aria-labelledby={id} aria-busy={busy || undefined}>
			<Card>
				<CardHeader>
					<CardTitle id={id}>{heading}</CardTitle>
					{description ? (
						<CardDescription>{description}</CardDescription>
					) : null}
				</CardHeader>
				{children}
			</Card>
		</section>
	);
}

/** The query: the app's version and platform. */
function InfoSection() {
	const info = useAboutInfo();
	const text = aboutStrings.info;
	return (
		<Section heading={text.heading} busy={info.isPending}>
			{info.error ? (
				<ErrorView error={info.error.error} />
			) : info.data ? (
				<dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
					<dt className="text-text-muted">{text.version}</dt>
					<dd className="mono-figures" data-slot="about-version">
						{info.data.version}
					</dd>
					<dt className="text-text-muted">{text.platform}</dt>
					<dd data-slot="about-platform">{info.data.platform}</dd>
				</dl>
			) : info.showPending ? (
				<div className="flex flex-col gap-2">
					<span className="sr-only">{text.loading}</span>
					<Skeleton className="w-48" />
				</div>
			) : null}
		</Section>
	);
}

/** The command with a revision: the note's working copy, its stale-write banner and its unsaved guard. */
function NoteSection() {
	const text = aboutStrings.note;
	const note = useAboutNote();
	const setNote = useAboutSetNote();
	const copy = useWorkingCopy({
		value: note.data?.note,
		revision: note.data?.revision,
		write: (draft, baseRevision) =>
			setNote.mutateAsync({ note: draft, baseRevision }),
		reread: () => note.refetch(),
	});
	const [saveError, setSaveError] = useState<StudioError>();
	const [elsewhere, setElsewhere] = useState(false);
	const changeElsewhere = async () => {
		const current = note.data;
		if (!current || elsewhere) return;
		setElsewhere(true);
		try {
			// Not through the working copy: a second writer, as another window would be.
			await requestStudio("about.setNote", {
				note: text.elsewhereText,
				baseRevision: current.revision,
			});
		} catch {
			// The next read shows whatever the note is now; a refusal here only means someone wrote first.
		} finally {
			setElsewhere(false);
		}
	};
	return (
		<Section
			heading={text.heading}
			description={text.description}
			busy={note.isPending}
		>
			<UnsavedChangesGuard
				label={text.unsavedLabel}
				what={text.what}
				file={text.file}
				discardLabel={text.discard}
				workingCopy={copy}
			/>
			<ChangedOnDisk file={text.file} workingCopy={copy} />
			{note.error ? <ErrorView error={note.error.error} /> : null}
			{saveError ? <ErrorView error={saveError} placement="banner" /> : null}
			<Textarea
				label={text.label}
				rows={3}
				value={copy.draft ?? ""}
				onChange={(value) => copy.setDraft(value)}
				isDisabled={note.data === undefined}
			/>
			<div className="flex flex-wrap items-center gap-2">
				<Button
					variant="primary"
					onPress={() => {
						setSaveError(undefined);
						// A conflict shows as the banner above; any other failure of this Save, here. (Keep mine's
						// own failure is ChangedOnDisk's to show.)
						void copy.save().then((outcome) => {
							if (!outcome.conflict) setSaveError(outcome.error?.error);
						});
					}}
					isDisabled={!copy.dirty || copy.conflict}
					isPending={copy.showPending}
				>
					{text.save}
				</Button>
				<Button
					onPress={() => {
						void changeElsewhere();
					}}
					isDisabled={note.data === undefined}
				>
					{text.changeElsewhere}
				</Button>
				<span className="text-ui-sm text-text-muted">
					{text.changeElsewhereHelp}
				</span>
			</div>
		</Section>
	);
}

/** The demo jobs to show: every live one and the newest that ended, in the order they started. */
function useDemoJobIds(): JobId[] {
	const key = useJobStore((state) => {
		const jobs = Object.values(state.jobs).filter(
			(job) => job.kind === DEMO_JOB,
		);
		const last = jobs[jobs.length - 1];
		return jobs
			.filter((job) => job === last || ACTIVE.has(job.state))
			.map((job) => job.id)
			.join(" ");
	});
	return key === "" ? [] : key.split(" ");
}

/** The job: start it, its progress and question, and its output. */
function DemoJobSection() {
	const text = aboutStrings.job;
	const demo = useAboutDemoJob();
	const jobIds = useDemoJobIds();
	const newest = useJobStore((state) => {
		const id = jobIds[jobIds.length - 1];
		return id === undefined ? undefined : state.jobs[id]?.streamId;
	});
	const [starting, setStarting] = useState(false);
	const [startError, setStartError] = useState<StudioError>();
	// Each press is its own call, with its own 300 ms before the button shows it is pending.
	const [runs, setRuns] = useState(0);
	const startLate = usePendingAfter(starting, runs);
	const run = () => {
		if (starting) return;
		setStarting(true);
		setRuns((n) => n + 1);
		setStartError(undefined);
		demo
			.start({})
			.catch((reason: unknown) => setStartError(failureOf(reason)))
			.finally(() => setStarting(false));
	};
	return (
		<Section heading={text.heading} description={text.description}>
			<div>
				<Button variant="primary" onPress={run} isPending={startLate}>
					{text.run}
				</Button>
			</div>
			{startError ? <ErrorView error={startError} placement="banner" /> : null}
			<JobProgressList
				jobIds={jobIds}
				renderResult={(job) => {
					const result = job.result as { steps?: number } | undefined;
					return result?.steps === undefined
						? undefined
						: text.result(result.steps);
				}}
			/>
			<StreamingList streamId={newest} label={text.output} className="h-48" />
		</Section>
	);
}

/** The session: start and stop the ticker (with the burst when asked) and its output. */
function TickerSection() {
	const text = aboutStrings.ticker;
	const session = useSession(TICKER);
	const [burst, setBurst] = useState(false);
	const live =
		session !== undefined &&
		session.state !== "stopped" &&
		session.state !== "failed";
	return (
		<Section heading={text.heading} description={text.description}>
			<Switch isSelected={burst} onChange={setBurst} isDisabled={live}>
				{text.burst}
			</Switch>
			<SessionControl
				kind={TICKER}
				title={text.title}
				args={burst ? { burst: BURST_LINES } : {}}
			/>
			<StreamingList
				streamId={session?.streamId}
				label={text.output}
				className="h-72"
			/>
		</Section>
	);
}
