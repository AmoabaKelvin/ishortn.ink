import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from "bun:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act } from "react";
import { createRoot } from "react-dom/client";

import { SectionErrorBoundary } from "./section-boundary";

import type { Root } from "react-dom/client";

let root: Root;
let container: HTMLDivElement;
let shouldThrow = true;
// The boundary logs what it caught; keep that out of the test output.
let consoleError: ReturnType<typeof spyOn<Console, "error">>;

function Flaky() {
  if (shouldThrow) throw new TypeError("Cannot read properties of null (reading 'events')");
  return <p>Webhooks list</p>;
}

beforeAll(() => {
  GlobalRegistrator.register();
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
});

afterAll(async () => {
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  await GlobalRegistrator.unregister();
});

beforeEach(() => {
  shouldThrow = true;
  consoleError = spyOn(console, "error").mockImplementation(() => {});
  container = document.createElement("div");
  root = createRoot(container, { onCaughtError: () => {} });
});

afterEach(() => {
  act(() => root.unmount());
  consoleError.mockRestore();
});

describe("SectionErrorBoundary", () => {
  test("a crashing section renders an inline error and the other sections still render", () => {
    act(() =>
      root.render(
        <>
          <SectionErrorBoundary section="webhooks" onRetry={() => {}}>
            <Flaky />
          </SectionErrorBoundary>
          <SectionErrorBoundary section="api-keys" onRetry={() => {}}>
            <p>API keys list</p>
          </SectionErrorBoundary>
        </>,
      ),
    );

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "This section couldn't load",
    );
    expect(container.textContent).toContain("API keys list");
    expect(container.textContent).not.toContain("Webhooks list");
  });

  test("Try again refreshes the data and renders the section again", () => {
    let retries = 0;
    act(() =>
      root.render(
        <SectionErrorBoundary section="webhooks" onRetry={() => (retries += 1)}>
          <Flaky />
        </SectionErrorBoundary>,
      ),
    );

    shouldThrow = false;
    const button = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Try again"),
    );
    act(() => button?.click());

    expect(retries).toBe(1);
    expect(container.textContent).toContain("Webhooks list");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  test("a fallback replaces the inline error, so a crashing nav renders nothing", () => {
    act(() =>
      root.render(
        <>
          <SectionErrorBoundary section="nav" fallback={null} onRetry={() => {}}>
            <Flaky />
          </SectionErrorBoundary>
          <p>Profile form</p>
        </>,
      ),
    );

    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toBe("Profile form");
  });
});
