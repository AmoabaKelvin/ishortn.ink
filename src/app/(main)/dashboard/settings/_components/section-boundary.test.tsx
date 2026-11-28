import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act } from "react";
import { createRoot } from "react-dom/client";

import { SectionBoundary } from "./section-boundary";

import type { Root } from "react-dom/client";

let root: Root;
let container: HTMLDivElement;
let thrown: Error | null = null;
// The boundary logs what it caught; keep that out of the test output.
let consoleError: ReturnType<typeof spyOn<Console, "error">>;
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;

function Flaky() {
  if (thrown) throw thrown;
  return <p>Webhooks list</p>;
}

// What production logged: a tab on the previous build calling into a chunk from the new one.
function staleChunkError() {
  const error = new TypeError("(0 , n.f) is not a function");
  error.stack =
    "TypeError: (0 , n.f) is not a function\n    at https://ishortn.ink/_next/static/chunks/0f1a2b3c4d5e6f70.js:1:2345";
  return error;
}

const alert = () => container.querySelector('[role="alert"]');

beforeAll(() => {
  GlobalRegistrator.register();
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
});

afterAll(async () => {
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  await GlobalRegistrator.unregister();
});

beforeEach(() => {
  thrown = new TypeError("Cannot read properties of null (reading 'events')");
  window.sessionStorage.clear();
  consoleError = spyOn(console, "error").mockImplementation(() => {});
  fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
  container = document.createElement("div");
  root = createRoot(container, { onCaughtError: () => {} });
});

afterEach(() => {
  act(() => root.unmount());
  consoleError.mockRestore();
  fetchSpy.mockRestore();
});

describe("SectionBoundary", () => {
  test("a crashing section renders an inline error and the other sections still render", () => {
    const reload = mock(() => {});
    act(() =>
      root.render(
        <>
          <SectionBoundary section="webhooks" reload={reload}>
            <Flaky />
          </SectionBoundary>
          <SectionBoundary section="api-keys" reload={reload}>
            <p>API keys list</p>
          </SectionBoundary>
        </>,
      ),
    );

    expect(alert()?.textContent).toContain("This section couldn't load");
    expect(container.textContent).toContain("API keys list");
    expect(container.textContent).not.toContain("Webhooks list");
    expect(reload).not.toHaveBeenCalled();
  });

  test("reports the caught error to the Worker logs", () => {
    act(() =>
      root.render(
        <SectionBoundary section="webhooks" reload={() => {}}>
          <Flaky />
        </SectionBoundary>,
      ),
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe("/api/client-errors");
    expect(String(init?.body)).toContain('"boundary":"settings:webhooks"');
  });

  test("Try again does a full page reload", () => {
    const reload = mock(() => {});
    act(() =>
      root.render(
        <SectionBoundary section="webhooks" reload={reload}>
          <Flaky />
        </SectionBoundary>,
      ),
    );

    const button = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Try again"),
    );
    act(() => button?.click());

    expect(reload).toHaveBeenCalledTimes(1);
  });

  test("a stale-build chunk error reloads once instead of showing the inline error", () => {
    thrown = staleChunkError();
    const reload = mock(() => {});
    act(() =>
      root.render(
        <>
          <SectionBoundary section="webhooks" reload={reload}>
            <Flaky />
          </SectionBoundary>
          <p>Profile form</p>
        </>,
      ),
    );

    expect(reload).toHaveBeenCalledTimes(1);
    expect(alert()).toBeNull();
    expect(container.textContent).toBe("Profile form");
  });

  test("the same chunk error right after the reload shows the inline error", () => {
    thrown = staleChunkError();
    const reload = mock(() => {});
    const page = (
      <SectionBoundary section="webhooks" reload={reload}>
        <Flaky />
      </SectionBoundary>
    );
    act(() => root.render(page));
    act(() => root.unmount());

    // The reloaded page still hits it: a real bug, so the loop guard shows the panel.
    root = createRoot(container, { onCaughtError: () => {} });
    act(() => root.render(page));

    expect(reload).toHaveBeenCalledTimes(1);
    expect(alert()?.textContent).toContain("This section couldn't load");
  });

  test("a fallback replaces the inline error, so a crashing nav renders nothing", () => {
    act(() =>
      root.render(
        <>
          <SectionBoundary section="nav" fallback={null} reload={() => {}}>
            <Flaky />
          </SectionBoundary>
          <p>Profile form</p>
        </>,
      ),
    );

    expect(alert()).toBeNull();
    expect(container.textContent).toBe("Profile form");
  });
});
