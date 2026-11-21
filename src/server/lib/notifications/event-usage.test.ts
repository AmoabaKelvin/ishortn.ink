import { describe, expect, test } from "bun:test";

import { render } from "@react-email/components";
import { createElement } from "react";

import EventUsageAlertEmail from "@/emails/event-usage-alert";
import { PLAN_CAPS, type Plan } from "@/lib/billing/plans";

import { eventUsageUpgrade } from "./event-usage";

const renderAlert = async (plan: Plan, threshold: number) => {
  const upgrade = eventUsageUpgrade(plan, threshold);
  if (!upgrade) throw new Error(`no upgrade for ${plan}`);
  const limit = PLAN_CAPS[plan].eventsLimit ?? 0;
  const html = await render(
    createElement(EventUsageAlertEmail, {
      ...EventUsageAlertEmail.PreviewProps,
      plan,
      threshold,
      limit,
      currentCount: Math.round((limit * threshold) / 100),
      upgrade,
    }),
  );
  const href = html.match(/href="([^"]*\/dashboard\/pricing[^"]*)"/)?.[1]?.replaceAll("&amp;", "&");
  return { html, url: new URL(href ?? "") };
};

describe("event usage alert email", () => {
  test("a Free user at the cap gets a tracked Upgrade to Pro link", async () => {
    const { html, url } = await renderAlert("free", 100);
    expect(html).toContain("Upgrade to Pro");
    expect(html).not.toContain("Compare plans");
    expect(url.pathname).toBe("/dashboard/pricing");
    expect(url.searchParams.get("highlight")).toBe("pro");
    expect(url.searchParams.get("source")).toBe("events_email_100");
    expect(url.searchParams.get("utm_source")).toBe("ishortn");
    expect(url.searchParams.get("utm_medium")).toBe("email");
    expect(url.searchParams.get("utm_campaign")).toBe("event-cap");
    expect(url.searchParams.has("plan")).toBe(false);
    expect(html).toContain("new visits aren&#x27;t recorded until your cap resets on");
    expect(html).toContain(
      `${PLAN_CAPS.pro.eventsLimit?.toLocaleString()} analytics events a month`,
    );
  });

  test("a Pro user is sent to Ultra", async () => {
    const { html, url } = await renderAlert("pro", 80);
    expect(html).toContain("Upgrade to Ultra");
    expect(url.searchParams.get("highlight")).toBe("ultra");
    expect(url.searchParams.get("source")).toBe("events_email_80");
    expect(url.searchParams.get("utm_campaign")).toBe("event-cap");
    expect(html).toContain("The Ultra plan has no monthly event cap.");
  });

  test("Ultra has no cap, so there is no upgrade to offer", () => {
    expect(eventUsageUpgrade("ultra", 100)).toBeNull();
  });
});
