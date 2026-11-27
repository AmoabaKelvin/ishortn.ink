import { describe, expect, test } from "bun:test";

import { render } from "@react-email/components";
import { createElement } from "react";

import EventUsageAlertEmail from "@/emails/event-usage-alert";
import { PLAN_CAPS, type Plan } from "@/lib/billing/plans";
import { ACTIVE_PROMO, type Promo } from "@/lib/billing/promo";
import { ALL_EMAIL_LINKS, emailLinkUrl } from "@/lib/email/links";

import { eventUsagePromo, eventUsageUpgrade } from "./event-usage";

const renderAlert = async (plan: Plan, threshold: number, promo: Promo | null = null) => {
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
      promo,
    }),
  );
  // The button is a tracked short link; check where it leads and how it is tagged.
  const link = ALL_EMAIL_LINKS.find((l) => html.includes(`href="${emailLinkUrl(l)}"`));
  if (!link) throw new Error("no tracked upgrade link");
  return { html, link, url: new URL(link.path, "https://ishortn.ink") };
};

describe("event usage alert email", () => {
  test("a Free user at the cap gets a tracked Upgrade to Pro link", async () => {
    const { html, link, url } = await renderAlert("free", 100);
    expect(html).toContain("Upgrade to Pro");
    expect(html).not.toContain("Compare plans");
    expect(url.pathname).toBe("/dashboard/pricing");
    expect(url.searchParams.get("highlight")).toBe("pro");
    expect(url.searchParams.get("source")).toBe("events_email_100");
    expect(link.utm).toEqual({
      utm_source: "email",
      utm_medium: "transactional",
      utm_campaign: "event_usage",
      utm_content: "pro_100",
    });
    expect(url.searchParams.has("plan")).toBe(false);
    expect(html).toContain("new clicks aren&#x27;t recorded until your cap resets on");
    expect(html).toContain(`${PLAN_CAPS.pro.eventsLimit?.toLocaleString()} tracked clicks a month`);
  });

  test("a Pro user is sent to Ultra", async () => {
    const { html, url } = await renderAlert("pro", 80);
    expect(html).toContain("Upgrade to Ultra");
    expect(url.searchParams.get("highlight")).toBe("ultra");
    expect(url.searchParams.get("source")).toBe("events_email_80");
    expect(html).toContain("The Ultra plan has no monthly cap on tracked clicks.");
  });

  test("Ultra has no cap, so there is no upgrade to offer", () => {
    expect(eventUsageUpgrade("ultra", 100)).toBeNull();
  });

  test("no promo line outside a promo", async () => {
    const { html } = await renderAlert("free", 100);
    expect(html).not.toContain("Black Friday");
  });

  test("a Free user inside the promo gets the offer", async () => {
    const { html, url } = await renderAlert("free", 90, ACTIVE_PROMO);
    expect(html).toContain(
      "Black Friday: Pro is 20% off your first year until Tuesday 1 December.",
    );
    expect(html).toContain("Upgrading resumes tracking straight away.");
    expect(url.searchParams.get("source")).toBe("events_email_90");
  });
});

describe("eventUsagePromo", () => {
  const inside = new Date("2026-11-27T10:00:00Z");

  test("only Free accounts starting a new checkout get the promo, only inside the window", () => {
    expect(eventUsagePromo("free", "checkout", inside)).toBe(ACTIVE_PROMO);
    expect(eventUsagePromo("free", "checkout", new Date("2026-11-24T10:00:00Z"))).toBeNull();
    expect(eventUsagePromo("free", "checkout", new Date("2026-12-02T10:00:00Z"))).toBeNull();
    expect(eventUsagePromo("free", "resume", inside)).toBeNull();
    expect(eventUsagePromo("pro", "update", inside)).toBeNull();
  });
});
