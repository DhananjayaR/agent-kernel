// NodeJobRecordStore: the desktop's JobRecordStore (the crash records behind `jobs.interrupted`). One JSON file
// per running job in a folder of the app's data folder (`<userData>/jobs/`, JOB_RECORDS_FOLDER, wired by
// registerServices), written when the job starts and replaced when it records a command. Each write goes to a
// temporary file in the same folder, flushed to disk (best effort) and then renamed over the record, so a crash
// mid-write never leaves half a record; the temporary files a crash leaves behind are removed on the store's
// first use. When the job ends its file is removed, so a file still there on the next start is a job that never
// ended. A corrupt file is skipped and logged (registerServices passes a masked log), never a failed start-up.
// Job ids reach `dismiss` from the renderer, so an id that is not a plain file name is refused before it is
// joined to a path.
import { randomUUID } from "node:crypto";
import { mkdir, open, readdir, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import {
	interruptedJobSchema,
	type JobId,
	type JobState,
} from "@ak-studio/contract";
import type { JobRecord, JobRecordStore, Log } from "@ak-studio/runtime";

/** The ids JobService makes (`job-<random>-<n>`) and nothing that could leave the folder. */
const SAFE_JOB_ID = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,199}$/;
const RECORD_SUFFIX = ".json";
/** A write's temporary file: `.<jobId>.<uuid>.tmp`. The leading dot keeps it out of the records. */
const TEMPORARY_SUFFIX = ".tmp";

/** The records folder's name inside the app's data folder. */
export const JOB_RECORDS_FOLDER = "jobs";

export interface NodeJobRecordStoreOptions {
	/** Where a corrupt record is reported. */
	log?: Log;
}

export class NodeJobRecordStore implements JobRecordStore {
	readonly #dir: string;
	readonly #log: Log;
	#swept: Promise<void> | undefined;

	/** `dir` is the records folder; it is created on the first write. */
	constructor(dir: string, options: NodeJobRecordStoreOptions = {}) {
		this.#dir = dir;
		this.#log =
			options.log ?? ((message) => console.error(`[studio] ${message}`));
	}

	async started(record: JobRecord): Promise<void> {
		const file = this.#file(record.jobId);
		if (!file)
			throw new Error(
				`refusing to write a record for job id "${record.jobId}"`,
			);
		const content = `${JSON.stringify(interruptedJobSchema.parse(record))}\n`;
		await this.#sweep();
		await mkdir(this.#dir, { recursive: true });
		// A leading dot and a suffix that is not ".json": never listed as a record if a crash leaves it behind.
		const temporary = join(
			this.#dir,
			`.${record.jobId}.${randomUUID()}${TEMPORARY_SUFFIX}`,
		);
		try {
			await writeDurably(temporary, content);
			await rename(temporary, file);
		} catch (err) {
			await rm(temporary, { force: true });
			throw err;
		}
	}

	async ended(jobId: JobId, _state: JobState): Promise<void> {
		const file = this.#file(jobId);
		if (file) await rm(file, { force: true });
	}

	async unfinished(): Promise<JobRecord[]> {
		await this.#sweep();
		let names: string[];
		try {
			names = await readdir(this.#dir);
		} catch (err) {
			if (errorCode(err) === "ENOENT") return [];
			this.#log(`could not read the job records folder: ${describe(err)}`);
			return [];
		}
		const records: JobRecord[] = [];
		for (const name of names) {
			if (name.startsWith(".") || !name.endsWith(RECORD_SUFFIX)) continue;
			const record = await this.#read(name);
			if (record) records.push(record);
		}
		return records.sort((a, b) => a.startedAt - b.startedAt);
	}

	async dismiss(jobId: JobId): Promise<boolean> {
		const file = this.#file(jobId);
		if (!file) return false;
		try {
			await rm(file);
			return true;
		} catch (err) {
			if (errorCode(err) === "ENOENT") return false;
			throw err;
		}
	}

	/** One record file, or undefined (logged) when it cannot be read or is not a record of the job it names. */
	async #read(name: string): Promise<JobRecord | undefined> {
		try {
			const parsed = interruptedJobSchema.safeParse(
				JSON.parse(await readFile(join(this.#dir, name), "utf8")),
			);
			if (!parsed.success) {
				this.#log(`skipping job record ${name}: it is not a job record`);
				return undefined;
			}
			if (`${parsed.data.jobId}${RECORD_SUFFIX}` !== name) {
				this.#log(`skipping job record ${name}: it names another job`);
				return undefined;
			}
			return parsed.data;
		} catch (err) {
			this.#log(`skipping job record ${name}: ${describe(err)}`);
			return undefined;
		}
	}

	/**
	 * Removes the temporary files a crash between write and rename left behind, once per store, before its first
	 * write or read. No write of this store can be in flight then, so none of its own files is removed. Failures
	 * are logged, never thrown.
	 */
	#sweep(): Promise<void> {
		this.#swept ??= (async () => {
			let names: string[];
			try {
				names = await readdir(this.#dir);
			} catch (err) {
				if (errorCode(err) !== "ENOENT")
					this.#log(
						`could not remove leftover temporary files from the job records folder: ${describe(err)}`,
					);
				return;
			}
			for (const name of names) {
				if (!name.startsWith(".") || !name.endsWith(TEMPORARY_SUFFIX)) continue;
				try {
					await rm(join(this.#dir, name), { force: true });
				} catch (err) {
					this.#log(
						`could not remove leftover temporary files from the job records folder (${name}): ${describe(err)}`,
					);
				}
			}
		})();
		return this.#swept;
	}

	/** The record file for `jobId`, or undefined when the id is not a plain file name. */
	#file(jobId: JobId): string | undefined {
		if (!SAFE_JOB_ID.test(jobId) || jobId.includes("..")) return undefined;
		return join(this.#dir, `${jobId}${RECORD_SUFFIX}`);
	}
}

/** Writes `content` to a new file and flushes it to disk before closing; a failed flush is not an error. */
async function writeDurably(path: string, content: string): Promise<void> {
	const handle = await open(path, "w");
	try {
		await handle.writeFile(content, "utf8");
		try {
			await handle.sync();
		} catch {
			// Best effort: some file systems refuse fsync. The rename still keeps the record whole or absent.
		}
	} finally {
		await handle.close();
	}
}

function errorCode(err: unknown): string | undefined {
	return typeof err === "object" && err !== null && "code" in err
		? String((err as { code: unknown }).code)
		: undefined;
}

function describe(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}
