import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act } from "react";
import { createRoot } from "react-dom/client";

import { useVersionSkewReload } from "./use-version-skew-reload";

import type { Root } from "react-dom/client";

// Stands in for an error boundary: renders nothing while reloading, else the error UI.
function Boundary({ error, reload }: { error: Error; reload: () => void }) {
  const reloading = useVersionSkewReload(error, reload);
  return reloading ? null : <p>Something went wrong</p>;
}

function chunkLoadError() {
  const error = new Error("Failed to load chunk /_next/static/chunks/0f1a2b3c4d5e6f70.js");
  error.name = "ChunkLoadError";
  return error;
}

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  GlobalRegistrator.register();
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
});

afterAll(async () => {
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  await GlobalRegistrator.unregister();
});

beforeEach(() => {
  window.sessionStorage.clear();
  container = document.createElement("div");
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
});

describe("useVersionSkewReload", () => {
  test("reloads on a skew error without showing the error UI", () => {
    const reload = mock(() => {});
    act(() => root.render(<Boundary error={chunkLoadError()} reload={reload} />));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe("");
  });

  test("shows the error UI when the error repeats right after the reload", () => {
    const reload = mock(() => {});
    act(() => root.render(<Boundary error={chunkLoadError()} reload={reload} />));
    act(() => root.unmount());

    // The page after the reload hits the same error again.
    root = createRoot(container);
    act(() => root.render(<Boundary error={chunkLoadError()} reload={reload} />));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe("Something went wrong");
  });

  test("shows the error UI straight away for other errors", () => {
    const reload = mock(() => {});
    act(() => root.render(<Boundary error={new Error("boom")} reload={reload} />));
    expect(reload).not.toHaveBeenCalled();
    expect(container.textContent).toBe("Something went wrong");
  });
});
