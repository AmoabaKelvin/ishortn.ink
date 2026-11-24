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

import * as events from "./events";
import { useTrackUpgradeShown } from "./upgrade-prompt";

import type { ReactNode } from "react";
import type { Root } from "react-dom/client";

function Prompt({
  source,
  enabled,
  label,
  promo,
}: {
  source: string;
  enabled?: boolean;
  label: string;
  promo?: string;
}) {
  useTrackUpgradeShown(source, enabled, promo ? { promo } : undefined);
  return <span>{label}</span>;
}

let root: Root;
let trackEvent: ReturnType<typeof spyOn<typeof events, "trackEvent">>;

beforeAll(() => {
  GlobalRegistrator.register();
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
});

afterAll(async () => {
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  await GlobalRegistrator.unregister();
});

beforeEach(() => {
  trackEvent = spyOn(events, "trackEvent").mockImplementation(() => {});
  root = createRoot(document.createElement("div"));
});

afterEach(() => {
  act(() => root.unmount());
  trackEvent.mockRestore();
});

const render = (node: ReactNode) => act(() => root.render(node));

const shownSources = () =>
  trackEvent.mock.calls
    .filter(([name]) => name === events.POSTHOG_EVENTS.UPGRADE_PROMPT_SHOWN)
    .map(([, properties]) => properties?.source);

describe("useTrackUpgradeShown", () => {
  test("fires once per mount, not on re-render", () => {
    render(<Prompt source="sidebar_free" label="a" />);
    render(<Prompt source="sidebar_free" label="b" />);
    render(<Prompt source="sidebar_free" label="c" />);
    expect(shownSources()).toEqual(["sidebar_free"]);
  });

  test("waits until enabled, and hiding and showing again doesn't count twice", () => {
    render(<Prompt source="promo_banner" enabled={false} label="a" />);
    expect(shownSources()).toEqual([]);
    render(<Prompt source="promo_banner" enabled label="a" />);
    render(<Prompt source="promo_banner" enabled={false} label="a" />);
    render(<Prompt source="promo_banner" enabled label="a" />);
    expect(shownSources()).toEqual(["promo_banner"]);
  });

  test("a new mount counts again", () => {
    render(<Prompt key="1" source="link_schedule" label="a" />);
    render(<Prompt key="2" source="link_schedule" label="a" />);
    expect(shownSources()).toEqual(["link_schedule", "link_schedule"]);
  });

  test("a source change while mounted counts the new source so clicks still pair", () => {
    render(<Prompt source="sidebar_free" label="a" />);
    render(<Prompt source="sidebar_free_at_limit" label="a" />);
    expect(shownSources()).toEqual(["sidebar_free", "sidebar_free_at_limit"]);
  });

  test("carries the promo code only for prompts that show the offer", () => {
    render(<Prompt key="1" source="sidebar_free" label="a" />);
    render(<Prompt key="2" source="sidebar_free" label="a" promo="BFCM20" />);
    const shown = trackEvent.mock.calls
      .filter(([name]) => name === events.POSTHOG_EVENTS.UPGRADE_PROMPT_SHOWN)
      .map(([, properties]) => properties);
    expect(shown).toEqual([
      { source: "sidebar_free" },
      { source: "sidebar_free", promo: "BFCM20" },
    ]);
  });

  test("carries extra properties such as the hidden click count", () => {
    function Notice() {
      useTrackUpgradeShown("link_analytics", true, { hidden_clicks: 1284, promo: "BFCM20" });
      return null;
    }
    render(<Notice />);
    render(<Notice />);
    expect(trackEvent.mock.calls).toEqual([
      [
        events.POSTHOG_EVENTS.UPGRADE_PROMPT_SHOWN,
        { source: "link_analytics", hidden_clicks: 1284, promo: "BFCM20" },
      ],
    ]);
  });
});
