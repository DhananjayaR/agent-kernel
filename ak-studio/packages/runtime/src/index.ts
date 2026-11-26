// @ak-studio/runtime: the browser-safe services core shared by the desktop main process and the renderer's mock
// transport (pre-flight ruling 9): the service registry, project scopes, secret masking, the events and stream
// services, JobService and SessionService, the list of feature services (features.ts), and the ports
// (CommandRunner, ProjectFs, Watcher, JobRecordStore, Clock) with their in-memory fakes.
// It may import only @ak-studio/contract, zod and itself (no Node built-in, no electron; enforced in
// .dependency-cruiser.cjs). The Node and Electron implementations of the ports live in apps/desktop.
export * from "./events";
export * from "./features";
export type { Log } from "./host";
export * from "./jobs";
export * from "./ports/clock";
export * from "./ports/commandRunner";
export * from "./ports/fakes";
export * from "./ports/jobRecordStore";
export * from "./ports/projectFs";
export * from "./ports/watcher";
export * from "./registry";
export * from "./scope";
export * from "./secrets";
export * from "./sessions";
export * from "./streams";
