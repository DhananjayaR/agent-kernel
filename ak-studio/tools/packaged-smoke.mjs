// `pnpm test:packaged`: starts the packaged app that `pnpm package` left in apps/desktop/release/ for this
// system and checks it, since a packaged build cannot be driven by Playwright (no --inspect, no remote
// debugging). It does not build or package: run `pnpm package` first.
//
// For each packaged app (Linux: linux-unpacked/ and the AppImage; Windows: win-unpacked/; macOS: the .app):
// 1. start: a fresh --user-data-dir; waits for "[studio] window shown" and "[studio] bridge ready" on stdout
//    (the window is up, and the renderer loaded and was answered over the bridge); fails on "refusing to start",
//    "could not load", an early exit or the time limit; then closes the app and expects exit code 0;
// 2. refusal: --remote-debugging-port=<free port> and --remote-debugging-pipe must exit non-zero with the refusal
//    line, and the port must never accept a connection while the process runs;
// 3. contents (unpacked directories): app.asar holds no development or test-hook code, and the font notices
//    file ships next to it.
//
// Linux needs an X server: in CI run it under `xvfb-run -a`. Windows and macOS paths are written but not yet
// run (deferred in P1a).
import { spawn, spawnSync } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { connect, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const desktopDir = join(import.meta.dirname, "../apps/desktop");
const releaseDir = join(desktopDir, "release");
const { productName } = JSON.parse(
	readFileSync(join(desktopDir, "package.json"), "utf8"),
);
/** electron-builder.yml `linux.executableName`. */
const LINUX_EXECUTABLE = "ak-studio";
const START_TIMEOUT_MS = 60_000;
const EXIT_TIMEOUT_MS = 15_000;
const READY_LINES = ["[studio] window shown", "[studio] bridge ready"];
const FAILURE_LINES = ["refusing to start", "could not load"];
const REFUSAL_LINE = "is not accepted by a packaged or production build";
/** Strings only main's development and test-hook code holds; the production bundle must not. */
const DEV_ONLY_STRINGS = ["AK_STUDIO_TEST_HOOKS", "ELECTRON_RENDERER_URL"];
const NOTICES_FILE = "THIRD-PARTY-NOTICES.txt";

const failures = [];
const fail = (target, message) => {
	failures.push(`${target.name}: ${message}`);
	console.error(`  FAIL ${message}`);
};
const pass = (message) => console.log(`  ok   ${message}`);

/** The packaged apps for this system: name, executable, resources folder (unpacked only), extra env. */
function targets() {
	const missing = (what) => {
		console.error(
			`packaged-smoke: ${what} not found under ${releaseDir}: run \`pnpm package\` first`,
		);
		process.exit(1);
	};
	if (!existsSync(releaseDir)) missing("release/");
	const list = [];
	if (process.platform === "linux") {
		const dir = join(releaseDir, "linux-unpacked");
		if (!existsSync(join(dir, LINUX_EXECUTABLE))) missing("linux-unpacked/");
		list.push({
			name: "linux-unpacked",
			command: join(dir, LINUX_EXECUTABLE),
			resources: join(dir, "resources"),
		});
		const appImage = readdirSync(releaseDir).find((f) =>
			f.endsWith(".AppImage"),
		);
		if (!appImage) missing("an AppImage");
		list.push({
			name: appImage,
			command: join(releaseDir, appImage),
			// Extracts to a temporary folder instead of mounting with FUSE 2, which CI runners may lack.
			env: { APPIMAGE_EXTRACT_AND_RUN: "1" },
		});
	} else if (process.platform === "win32") {
		// Not yet run (Windows is deferred in P1a). The NSIS installer installs this folder's contents.
		const dir = join(releaseDir, "win-unpacked");
		if (!existsSync(dir)) missing("win-unpacked/");
		list.push({
			name: "win-unpacked",
			command: join(dir, `${productName}.exe`),
			resources: join(dir, "resources"),
		});
	} else if (process.platform === "darwin") {
		// Not yet run (macOS is deferred in P1a). The dmg holds this .app.
		const dir = readdirSync(releaseDir).find(
			(f) => f === "mac" || f.startsWith("mac-"),
		);
		if (!dir) missing("mac*/");
		const app = join(releaseDir, dir, `${productName}.app`);
		list.push({
			name: `${dir}/${productName}.app`,
			command: join(app, "Contents/MacOS", productName),
			resources: join(app, "Contents/Resources"),
		});
	} else {
		console.error(`packaged-smoke: unsupported platform ${process.platform}`);
		process.exit(1);
	}
	return list;
}

/** A copy of this process's environment without anything that changes how the app starts. */
function appEnv(extra = {}) {
	const env = { ...process.env, ...extra };
	for (const key of [
		"ELECTRON_RUN_AS_NODE",
		"ELECTRON_RENDERER_URL",
		"AK_STUDIO_TEST_HOOKS",
		"NODE_OPTIONS",
	]) {
		delete env[key];
	}
	return env;
}

/**
 * Starts the app with a fresh data folder (the single-instance lock is keyed on it). On Linux and macOS the app
 * leads its own process group, so the whole tree can be signalled.
 */
function launch(target, args, stdio = ["ignore", "pipe", "pipe"]) {
	const userDataDir = mkdtempSync(join(tmpdir(), "ak-studio-smoke-"));
	const child = spawn(
		target.command,
		[`--user-data-dir=${userDataDir}`, ...args],
		{
			env: appEnv(target.env),
			stdio,
			detached: process.platform !== "win32",
		},
	);
	const run = { child, output: "", exit: undefined, userDataDir };
	child.stdout?.on("data", (chunk) => {
		run.output += chunk;
	});
	child.stderr?.on("data", (chunk) => {
		run.output += chunk;
	});
	run.exited = new Promise((resolve) => {
		child.on("error", (err) => {
			run.exit = { code: null, signal: null, error: err.message };
			resolve(run.exit);
		});
		child.on("exit", (code, signal) => {
			run.exit = { code, signal };
			resolve(run.exit);
		});
	});
	return run;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls until `done()` is true or `ms` passes (or, unless `afterExit`, the process exits). */
async function waitFor(run, done, ms, { afterExit = false } = {}) {
	const deadline = Date.now() + ms;
	while (Date.now() < deadline) {
		if (done()) return true;
		if (run.exit && !afterExit) return done();
		await sleep(50);
	}
	return done();
}

/**
 * The app's browser (main) process on Linux: the process of the app's group that has no `--type=` argument and
 * no such child. For the AppImage that is the app under the AppImage runtime, which does not pass signals on.
 */
function linuxMainPid(run) {
	const procs = [];
	for (const entry of readdirSync("/proc")) {
		if (!/^\d+$/.test(entry)) continue;
		try {
			// Fields after the command name, which is in parentheses and may hold spaces.
			const stat = readFileSync(`/proc/${entry}/stat`, "utf8");
			const [, , ppid, pgid] = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
			if (Number(pgid) !== run.child.pid) continue;
			// Chromium rewrites its helpers' titles, so cmdline may be one space-separated string.
			const cmdline = readFileSync(`/proc/${entry}/cmdline`, "utf8");
			if (/(^|[\0 ])--type=/.test(cmdline)) continue;
			procs.push({ pid: Number(entry), ppid: Number(ppid) });
		} catch {
			// Gone meanwhile.
		}
	}
	const parents = new Set(procs.map((p) => p.ppid));
	return procs.find((p) => !parents.has(p.pid))?.pid ?? run.child.pid;
}

/**
 * Asks the app to close: SIGTERM to the browser process only (Chromium shuts down gracefully and takes its
 * helpers with it; signalling the whole group kills the helpers first and the app crashes); on Windows,
 * taskkill without /F, which closes the window.
 */
function requestClose(run) {
	if (process.platform === "win32") {
		spawnSync("taskkill", ["/PID", String(run.child.pid), "/T"]);
		return;
	}
	const pid = process.platform === "linux" ? linuxMainPid(run) : run.child.pid;
	try {
		process.kill(pid, "SIGTERM");
	} catch {
		// Already gone.
	}
}

/** Kills whatever is left of the app's process tree. */
function forceKill(run) {
	if (process.platform === "win32") {
		spawnSync("taskkill", ["/PID", String(run.child.pid), "/T", "/F"]);
	} else {
		try {
			process.kill(-run.child.pid, "SIGKILL");
		} catch {
			// Already gone.
		}
	}
}

/** Whether any process of the app's group is still running (Linux and macOS). */
function groupAlive(run) {
	if (process.platform === "win32") return false;
	try {
		process.kill(-run.child.pid, 0);
		return true;
	} catch {
		return false;
	}
}

async function cleanUp(run) {
	if (!run.exit || groupAlive(run)) forceKill(run);
	await Promise.race([run.exited, sleep(EXIT_TIMEOUT_MS)]);
	rmSync(run.userDataDir, {
		recursive: true,
		force: true,
		maxRetries: 5,
		retryDelay: 200,
	});
}

const lastLines = (run) =>
	run.output.trim().split("\n").slice(-8).join("\n    ");

async function checkStart(target) {
	const run = launch(target, []);
	try {
		const ready = () => READY_LINES.every((line) => run.output.includes(line));
		const broken = () =>
			FAILURE_LINES.some((line) => run.output.includes(line));
		await waitFor(run, () => ready() || broken(), START_TIMEOUT_MS);
		if (broken()) {
			fail(target, `start-up error:\n    ${lastLines(run)}`);
			return;
		}
		if (!ready()) {
			const why = run.exit
				? `exited early (${JSON.stringify(run.exit)})`
				: `timed out after ${START_TIMEOUT_MS} ms`;
			fail(
				target,
				`no ${READY_LINES.join(" + ")}: ${why}\n    ${lastLines(run)}`,
			);
			return;
		}
		pass(`started: ${READY_LINES.join(", ")}`);
		requestClose(run);
		const exit = await Promise.race([run.exited, sleep(EXIT_TIMEOUT_MS)]);
		if (!exit) {
			fail(target, `did not exit within ${EXIT_TIMEOUT_MS} ms of closing`);
			return;
		}
		if (exit.code !== 0) {
			fail(target, `closed with ${JSON.stringify(exit)}, expected exit code 0`);
			return;
		}
		// Chromium's helper processes leave with the browser process.
		await waitFor(run, () => !groupAlive(run), EXIT_TIMEOUT_MS, {
			afterExit: true,
		});
		if (groupAlive(run)) {
			fail(target, "helper processes still running after the app exited");
			return;
		}
		pass("closed cleanly (exit code 0, no process left)");
	} finally {
		await cleanUp(run);
	}
}

/** A TCP port that was free a moment ago. */
function freePort() {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.unref();
		server.on("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address();
			server.close(() => resolve(port));
		});
	});
}

/** Whether something accepts a TCP connection on 127.0.0.1:port right now. */
function portOpen(port) {
	return new Promise((resolve) => {
		const socket = connect({ host: "127.0.0.1", port });
		socket.setTimeout(200);
		const done = (open) => {
			socket.destroy();
			resolve(open);
		};
		socket.once("connect", () => done(true));
		socket.once("error", () => done(false));
		socket.once("timeout", () => done(false));
	});
}

async function checkRefusal(target, label, args, stdio, port) {
	const run = launch(target, args, stdio);
	let opened = false;
	try {
		// Polled for the whole life of the process, not once.
		const deadline = Date.now() + START_TIMEOUT_MS;
		while (!run.exit && Date.now() < deadline) {
			if (port && (await portOpen(port))) opened = true;
			await sleep(50);
		}
		if (port && (await portOpen(port))) opened = true;
		if (!run.exit) {
			fail(target, `${label}: still running after ${START_TIMEOUT_MS} ms`);
			return;
		}
		const problems = [];
		if (run.exit.code === 0 || run.exit.code === null) {
			problems.push(`exit ${JSON.stringify(run.exit)}, expected non-zero`);
		}
		if (!run.output.includes(REFUSAL_LINE)) {
			problems.push(`no "${REFUSAL_LINE}" line`);
		}
		if (opened) problems.push(`port ${port} accepted a connection`);
		if (problems.length > 0) {
			fail(target, `${label}: ${problems.join("; ")}\n    ${lastLines(run)}`);
			return;
		}
		pass(
			`${label}: refused (exit code ${run.exit.code}${port ? `, port ${port} never opened` : ""})`,
		);
	} finally {
		await cleanUp(run);
	}
}

function checkContents(target) {
	if (!target.resources) return;
	const asar = readFileSync(join(target.resources, "app.asar"));
	const found = DEV_ONLY_STRINGS.filter((s) => asar.includes(s));
	if (found.length > 0) {
		fail(target, `app.asar holds development code: ${found.join(", ")}`);
	} else {
		pass(`app.asar holds none of ${DEV_ONLY_STRINGS.join(", ")}`);
	}
	if (existsSync(join(target.resources, NOTICES_FILE))) {
		pass(`${NOTICES_FILE} ships in resources`);
	} else {
		fail(target, `${NOTICES_FILE} missing from ${target.resources}`);
	}
}

if (process.platform === "linux" && !process.env.DISPLAY) {
	console.error(
		"packaged-smoke: no DISPLAY; run it under an X server (`xvfb-run -a pnpm test:packaged`)",
	);
	process.exit(1);
}

for (const target of targets()) {
	console.log(`packaged-smoke: ${target.name}`);
	checkContents(target);
	await checkStart(target);
	const port = await freePort();
	await checkRefusal(
		target,
		`--remote-debugging-port=${port}`,
		[`--remote-debugging-port=${port}`],
		undefined,
		port,
	);
	// The pipe transport talks over file descriptors 3 and 4.
	await checkRefusal(
		target,
		"--remote-debugging-pipe",
		["--remote-debugging-pipe"],
		["ignore", "pipe", "pipe", "pipe", "pipe"],
	);
}

if (failures.length > 0) {
	console.error(`packaged-smoke FAILED:\n  ${failures.join("\n  ")}`);
	process.exit(1);
}
console.log("packaged-smoke OK");
