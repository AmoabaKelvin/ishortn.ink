type Ext = typeof chrome;

// Firefox exposes the promise-based `browser` namespace; Chromium only has `chrome`, which also
// returns promises under MV3. Prefer `browser` so the same calls work in both.
const scope = globalThis as unknown as { browser?: Ext; chrome?: Ext };
const resolved = scope.browser ?? scope.chrome;
if (!resolved) throw new Error("Extension APIs are unavailable in this context.");

export const ext: Ext = resolved;
