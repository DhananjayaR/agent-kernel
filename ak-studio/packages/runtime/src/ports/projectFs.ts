// The ProjectFs port: the only thing that touches the project's working directory (architecture, "Writing
// files safely"). Every read answers a revision (a content hash); every write carries the revision it was
// edited from, and a stale one fails with `file.changedOnDisk`, whose `current` holds the file's content inside the
// main process only (across the bridge the error carries no content). Paths that resolve outside the project
// folder fail with `file.outsideProject`. The desktop implements it on Node from
// P2; tests and the browser's mock use FakeProjectFs.
import { ERROR_CODES, type Revision, StudioFailure } from "@ak-studio/contract";
import { strings } from "../strings";

export interface FileSnapshot {
	content: string;
	revision: Revision;
}

export interface ProjectFs {
	/** The project folder every path is resolved against. */
	readonly root: string;
	/** Reads a file: a path relative to the root, or an absolute path inside it. */
	read(path: string): Promise<FileSnapshot>;
	/**
	 * Writes a file if its current revision is `baseRevision`; `null` creates a file that must not exist yet.
	 * Answers the new revision.
	 */
	write(
		path: string,
		content: string,
		baseRevision: Revision | null,
	): Promise<{ revision: Revision }>;
}

/**
 * `file.changedOnDisk`: the write's base revision is not the file's current one. `current` carries the file as
 * it is now, for the changed-on-disk pattern; it does not cross the bridge inside the StudioError (which has no
 * field for it), so the service that catches this decides what to answer.
 */
export class FileChangedOnDiskFailure extends StudioFailure {
	readonly current: FileSnapshot;

	constructor(path: string, current: FileSnapshot) {
		super({
			code: ERROR_CODES.fileChangedOnDisk,
			message: strings.fileChangedOnDisk,
			file: path,
		});
		this.current = current;
	}
}

/** `file.outsideProject`, for a path that resolves outside the project folder. */
export function outsideProject(path: string): StudioFailure {
	return new StudioFailure({
		code: ERROR_CODES.fileOutsideProject,
		message: strings.fileOutsideProject,
		detail: path,
	});
}

/** `file.notFound`, for a file that does not exist in the project folder. */
export function fileNotFound(path: string): StudioFailure {
	return new StudioFailure({
		code: ERROR_CODES.fileNotFound,
		message: strings.fileNotFound,
		file: path,
	});
}
