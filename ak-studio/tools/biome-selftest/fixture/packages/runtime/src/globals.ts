// Violation: packages/runtime runs in Electron main too, which has no window or document.
export const a = [window.location, document.title];
