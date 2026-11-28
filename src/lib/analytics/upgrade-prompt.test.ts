import { afterEach, describe, expect, spyOn, test } from "bun:test";

import { toast } from "sonner";

import { ACTIVE_PROMO } from "@/lib/billing/promo";
import { monthlyLinkLimitMessage } from "@/server/lib/user-plan";

import * as events from "./events";
import { notifyPlanLimit, trackUpgradeClick, trackUpgradeShown } from "./upgrade-prompt";

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("notifyPlanLimit", () => {
  test("the toast's Upgrade action opens pricing with the required plan preselected", () => {
    notifyPlanLimit("Folders are available on Pro and Ultra plans.", "folder_create", "pro");

    const shown = toast.getHistory().at(-1);
    expect(shown && "title" in shown ? shown.title : null).toBe(
      "Folders are available on Pro and Ultra plans.",
    );
    const action = shown && "action" in shown ? shown.action : undefined;
    expect(action && "label" in action ? action.label : null).toBe("Upgrade");

    const location = { href: "" };
    // The action assigns window.location.href (and analytics checks window exists).
    Object.defineProperty(globalThis, "window", { value: { location }, configurable: true });
    if (action && "onClick" in action) {
      // SAFETY: the handler ignores its event argument.
      action.onClick({} as never);
    }
    expect(location.href).toBe("/dashboard/pricing?highlight=pro&source=folder_create");
  });

  test("records the limit and the prompt impression under the same source", () => {
    const spy = spyOn(events, "trackEvent").mockImplementation(() => {});
    notifyPlanLimit(monthlyLinkLimitMessage("free", 30), "link_create", "pro");
    const calls = spy.mock.calls;
    spy.mockRestore();
    expect(calls).toEqual([
      [
        events.POSTHOG_EVENTS.PLAN_LIMIT_REACHED,
        { source: "link_create", limit_key: "monthly_links" },
      ],
      [events.POSTHOG_EVENTS.UPGRADE_PROMPT_SHOWN, { source: "link_create" }],
    ]);
  });

  test("with a promo the toast states the offer and the prompt is attributed to it", () => {
    const spy = spyOn(events, "trackEvent").mockImplementation(() => {});
    notifyPlanLimit(monthlyLinkLimitMessage("free", 30), "link_create", "pro", ACTIVE_PROMO);

    const shown = toast.getHistory().at(-1);
    expect(shown && "description" in shown ? shown.description : null).toBe(
      "Black Friday: Pro is 20% off your first year until Tuesday 1 December.",
    );
    const location = { href: "" };
    Object.defineProperty(globalThis, "window", { value: { location }, configurable: true });
    const action = shown && "action" in shown ? shown.action : undefined;
    if (action && "onClick" in action) {
      // SAFETY: the handler ignores its event argument.
      action.onClick({} as never);
    }
    const calls = spy.mock.calls;
    spy.mockRestore();

    expect(new URL(location.href, "https://ishortn.ink").searchParams.get("utm_campaign")).toBe(
      "bfcm2026",
    );
    expect(calls).toEqual([
      [
        events.POSTHOG_EVENTS.PLAN_LIMIT_REACHED,
        { source: "link_create", limit_key: "monthly_links" },
      ],
      [events.POSTHOG_EVENTS.UPGRADE_PROMPT_SHOWN, { source: "link_create", promo: "BFCM20" }],
      [events.POSTHOG_EVENTS.UPGRADE_PROMPT_CLICKED, { source: "link_create", promo: "BFCM20" }],
    ]);
  });

  test("without a promo the toast has no description", () => {
    notifyPlanLimit("Folders are available on Pro and Ultra plans.", "folder_create", "pro", null);
    const shown = toast.getHistory().at(-1);
    expect(shown && "description" in shown ? shown.description : undefined).toBeUndefined();
  });
});

describe("trackUpgradeShown / trackUpgradeClick", () => {
  test("carry the promo code only when one is passed", () => {
    const spy = spyOn(events, "trackEvent").mockImplementation(() => {});
    trackUpgradeShown("sidebar_free");
    trackUpgradeShown("sidebar_free", { promo: "BFCM20" });
    trackUpgradeClick("sidebar_free");
    trackUpgradeClick("sidebar_free", { promo: "BFCM20" });
    const calls = spy.mock.calls;
    spy.mockRestore();
    expect(calls.map(([, properties]) => properties)).toEqual([
      { source: "sidebar_free" },
      { source: "sidebar_free", promo: "BFCM20" },
      { source: "sidebar_free" },
      { source: "sidebar_free", promo: "BFCM20" },
    ]);
  });
});
