// A tab opened before a deploy can still try to load the previous build's chunks (a cached
// prefetch, a lazily loaded dialog) after the Worker has moved on. Those chunks are gone or
// mismatched, which surfaces as a chunk load failure or as a minified cross-module call to an
// export that doesn't exist in the loaded module. A full reload fetches the current build.

const RELOAD_KEY = "ishortn:skew-reload-at";
// A reload that hits the same error inside this window is a real bug, not skew: show the error UI.
export const SKEW_RELOAD_WINDOW_MS = 60_000;

type SkewStorage = Pick<Storage, "getItem" | "setItem">;

export function isVersionSkewError(error: Error): boolean {
  // Turbopack names it ChunkLoadError ("Failed to load chunk …"); webpack says
  // "Loading chunk 123 failed" / "Loading CSS chunk 123 failed".
  if (error.name === "ChunkLoadError") return true;
  if (/Loading (CSS )?chunk .+ failed|Failed to load chunk/i.test(error.message)) return true;
  // The stack can't tell skew apart: every production client error points into a chunk. Only the
  // bundler's cross-module call shape (`(0 , n.f) is not a function`) is specific enough.
  return error.name === "TypeError" && /^\(0 , \w+\.\w+\) is not a function$/.test(error.message);
}

/**
 * True when the error is skew and no skew reload happened within the window. Without storage
 * there is no loop guard, so it never reloads.
 */
export function shouldReloadForSkew(error: Error, storage: SkewStorage | null, now = Date.now()) {
  if (!storage || !isVersionSkewError(error)) return false;
  try {
    const last = Number(storage.getItem(RELOAD_KEY));
    return !last || now - last >= SKEW_RELOAD_WINDOW_MS;
  } catch {
    return false;
  }
}

export function markSkewReload(storage: SkewStorage, now = Date.now()) {
  try {
    storage.setItem(RELOAD_KEY, String(now));
  } catch {
    // Storage full or blocked: shouldReloadForSkew would fail its read the same way.
  }
}

export function getSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    // ReferenceError during SSR; SecurityError when the browser blocks site storage.
    return null;
  }
}
