import { describe, expect, test } from "bun:test";

import {
  SKEW_RELOAD_WINDOW_MS,
  isVersionSkewError,
  markSkewReload,
  shouldReloadForSkew,
} from "./version-skew";

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

function chunkTypeError() {
  const error = new TypeError("(0 , n.f) is not a function");
  error.stack =
    "TypeError: (0 , n.f) is not a function\n    at https://ishortn.ink/_next/static/chunks/0f1a2b3c4d5e6f70.js:1:2345";
  return error;
}

function chunkLoadError() {
  const error = new Error("Failed to load chunk /_next/static/chunks/0f1a2b3c4d5e6f70.js");
  error.name = "ChunkLoadError";
  return error;
}

describe("isVersionSkewError", () => {
  test("matches chunk load failures from Turbopack and webpack", () => {
    expect(isVersionSkewError(chunkLoadError())).toBe(true);
    expect(isVersionSkewError(new Error("Loading chunk 812 failed."))).toBe(true);
    expect(isVersionSkewError(new Error("Loading CSS chunk 3 failed. (/_next/x.css)"))).toBe(true);
  });

  test("matches the minified cross-module call to a missing export", () => {
    expect(isVersionSkewError(chunkTypeError())).toBe(true);
  });

  test("ignores other errors", () => {
    const typeError = new TypeError("x is not a function");
    typeError.stack = "TypeError: x is not a function\n    at https://ishortn.ink/app.js:1:1";
    expect(isVersionSkewError(typeError)).toBe(false);
    expect(isVersionSkewError(new Error("NOT_FOUND"))).toBe(false);
  });

  test("ignores ordinary TypeErrors even when the stack points into a build chunk", () => {
    const nullAccess = new TypeError("Cannot read properties of null (reading 'events')");
    nullAccess.stack =
      "TypeError: Cannot read properties of null (reading 'events')\n    at https://ishortn.ink/_next/static/chunks/0f1a2b3c4d5e6f70.js:1:2345";
    expect(isVersionSkewError(nullAccess)).toBe(false);
    expect(
      isVersionSkewError(new TypeError("(0 , n.f) is not a function or its return value")),
    ).toBe(false);
  });
});

describe("shouldReloadForSkew", () => {
  test("reloads once, then lets the error UI show inside the window", () => {
    const storage = memoryStorage();
    expect(shouldReloadForSkew(chunkLoadError(), storage, 1_000_000)).toBe(true);
    markSkewReload(storage, 1_000_000);
    expect(shouldReloadForSkew(chunkTypeError(), storage, 1_005_000)).toBe(false);
  });

  test("reloads again for a later deploy once the window has passed", () => {
    const storage = memoryStorage();
    markSkewReload(storage, 1_000_000);
    expect(shouldReloadForSkew(chunkLoadError(), storage, 1_000_000 + SKEW_RELOAD_WINDOW_MS)).toBe(
      true,
    );
  });

  test("never reloads for errors that aren't skew", () => {
    expect(shouldReloadForSkew(new Error("boom"), memoryStorage())).toBe(false);
  });

  test("doesn't reload without storage, since nothing could stop a loop", () => {
    expect(shouldReloadForSkew(chunkLoadError(), null)).toBe(false);
  });

  test("doesn't reload when storage throws, since nothing could stop a loop", () => {
    const storage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {},
    };
    expect(shouldReloadForSkew(chunkLoadError(), storage)).toBe(false);
  });
});
