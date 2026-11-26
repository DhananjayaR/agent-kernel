// The Watcher port: reports changes to files under a project folder, so services can tell the renderer a
// domain changed (a `domain.changed` event) or a working copy changed on disk. The desktop implements it on
// Node from P2; tests and the browser's mock use FakeWatcher.

export interface Watcher {
	/** Calls `onChange` with the changed paths (relative to `root`) until the returned function is called. */
	watch(root: string, onChange: (paths: string[]) => void): () => void;
}
