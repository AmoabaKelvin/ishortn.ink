import { describe, expect, test } from "bun:test";

import {
  eventsUpgradeTarget,
  formatResetDay,
  isDismissalActive,
  pricingHighlightHref,
  TRACKING_PAUSED_DISMISS_MS,
  trackingPausedBannerState,
} from "./tracking-paused";

describe("eventsUpgradeTarget", () => {
  test("free accounts are sent to Pro", () => {
    expect(eventsUpgradeTarget("free")).toEqual({ plan: "pro", label: "Upgrade to Pro" });
  });

  test("Pro accounts are sent to Ultra", () => {
    expect(eventsUpgradeTarget("pro")).toEqual({ plan: "ultra", label: "Upgrade to Ultra" });
  });

  test("Ultra has no event cap, so there is nothing to upgrade to", () => {
    expect(eventsUpgradeTarget("ultra")).toBeNull();
  });
});

describe("pricingHighlightHref", () => {
  test("preselects with highlight, never with the auto-checkout plan param", () => {
    const href = pricingHighlightHref("pro", "events_paused_banner");
    expect(href).toBe("/dashboard/pricing?highlight=pro&source=events_paused_banner");
    expect(new URL(href, "https://ishortn.ink").searchParams.has("plan")).toBe(false);
  });
});

describe("isDismissalActive", () => {
  const now = Date.UTC(2026, 10, 21, 12);

  test("no stored dismissal shows the banner", () => {
    expect(isDismissalActive(null, now)).toBe(false);
    expect(isDismissalActive("", now)).toBe(false);
    expect(isDismissalActive("garbage", now)).toBe(false);
  });

  test("a dismissal hides the banner for 24 hours", () => {
    expect(isDismissalActive(String(now - 1000), now)).toBe(true);
    expect(isDismissalActive(String(now - TRACKING_PAUSED_DISMISS_MS + 1), now)).toBe(true);
  });

  test("the banner returns after 24 hours", () => {
    expect(isDismissalActive(String(now - TRACKING_PAUSED_DISMISS_MS), now)).toBe(false);
  });

  test("a timestamp from the future does not hide it indefinitely", () => {
    expect(isDismissalActive(String(now + 60_000), now)).toBe(false);
  });
});

describe("formatResetDay", () => {
  test("renders in UTC so server and client agree", () => {
    expect(formatResetDay(new Date(Date.UTC(2026, 11, 1)))).toBe("Dec 1");
  });
});

// The banner is rendered by the dashboard layout, so this state decides it for every dashboard
// route: the links list, analytics overview, QR code detail, bio pages and campaigns.
describe("trackingPausedBannerState", () => {
  const pause = {
    dropped: 312,
    pausedAt: new Date(Date.UTC(2026, 10, 18)),
    resetsAt: new Date(Date.UTC(2026, 11, 1)),
  };
  const subscription = (
    overrides: Partial<{ plan: "free" | "pro" | "ultra"; isTeamWorkspace: boolean }> = {},
    paused: typeof pause | null = pause,
  ) => ({
    plan: "free" as const,
    isTeamWorkspace: false,
    ...overrides,
    usage: { events: { paused } },
  });

  test("shows the Pro CTA to a paused free account", () => {
    expect(trackingPausedBannerState(subscription())).toEqual({
      pause,
      target: { plan: "pro", label: "Upgrade to Pro" },
    });
  });

  test("shows the Ultra CTA to a paused Pro account", () => {
    expect(trackingPausedBannerState(subscription({ plan: "pro" }))?.target).toEqual({
      plan: "ultra",
      label: "Upgrade to Ultra",
    });
  });

  test("hidden while tracking is not paused", () => {
    expect(trackingPausedBannerState(subscription({}, null))).toBeNull();
  });

  test("hidden in team workspaces", () => {
    expect(trackingPausedBannerState(subscription({ isTeamWorkspace: true }))).toBeNull();
  });

  test("hidden when the subscription could not be loaded or the plan is Ultra", () => {
    expect(trackingPausedBannerState(null)).toBeNull();
    expect(trackingPausedBannerState(subscription({ plan: "ultra" }))).toBeNull();
  });
});
