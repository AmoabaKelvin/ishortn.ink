import { describe, expect, test } from "bun:test";

import { render } from "@react-email/components";
import { createElement } from "react";

import EventUsageAlertEmail, { eventUsageSubject } from "@/emails/event-usage-alert";
import { PLAN_CAPS, type Plan } from "@/lib/billing/plans";
import { ACTIVE_PROMO, type Promo } from "@/lib/billing/promo";
import { ALL_EMAIL_LINKS, emailLinkUrl } from "@/lib/email/links";

import { eventUsagePromo, eventUsageUpgrade, onPaceToReachLimit } from "./event-usage";

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
  test("a Free user at the cap gets a tracked link to Pro", async () => {
    const { html, link, url } = await renderAlert("free", 100);
    expect(html).toContain("Track every click");
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
    expect(html).toContain("new clicks won&#x27;t show in your analytics until");
    expect(html).toContain(
      `${PLAN_CAPS.pro.eventsLimit?.toLocaleString()} tracked clicks a month, and upgrading resumes tracking straight away.`,
    );
  });

  test("a Pro user is sent to Ultra", async () => {
    const { html, url } = await renderAlert("pro", 80);
    expect(html).toContain("Upgrade to Ultra");
    expect(url.searchParams.get("highlight")).toBe("ultra");
    expect(url.searchParams.get("source")).toBe("events_email_80");
    expect(html).toContain("Ultra has no monthly limit on tracked clicks.");
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

describe("event usage alert copy", () => {
  test("the subject states the consequence", () => {
    expect(eventUsageSubject({ threshold: 100, resetDate: "December 1" })).toBe(
      "Click tracking is paused until December 1",
    );
    expect(eventUsageSubject({ threshold: 80, resetDate: "December 1" })).toBe(
      "You've used 80% of this month's tracked clicks",
    );
  });

  test("the 100% email leads with links still working", async () => {
    const html = await render(
      createElement(EventUsageAlertEmail, EventUsageAlertEmail.PreviewProps),
    );
    expect(html).toContain(
      "Your links still work. Clicks from now until December 1 won&#x27;t show in your analytics.",
    );
    expect(html).toMatch(/<h1[^>]*>Click tracking is paused until December 1<\/h1>/);
  });

  test("the 80% preview mentions the pace only when the projection supports it", async () => {
    const props = {
      ...EventUsageAlertEmail.PreviewProps,
      threshold: 80,
      currentCount: 800,
    };
    const onPace = await render(createElement(EventUsageAlertEmail, props));
    expect(onPace).toContain(
      "800 of 1,000. At this pace you&#x27;ll reach the limit before December 1.",
    );

    const offPace = await render(
      createElement(EventUsageAlertEmail, { ...props, onPaceToReachLimit: false }),
    );
    expect(offPace).toContain("800 of 1,000. Your count resets on December 1.");
    expect(offPace).not.toContain("At this pace");
  });
});

describe("onPaceToReachLimit", () => {
  const resetsAt = new Date(2026, 11, 1);

  test("800 clicks in the first 10 days of a 30-day month reach 1,000", () => {
    expect(onPaceToReachLimit(800, 1000, resetsAt, new Date(2026, 10, 11))).toBe(true);
  });

  test("800 clicks by day 28 stay under 1,000", () => {
    expect(onPaceToReachLimit(800, 1000, resetsAt, new Date(2026, 10, 29))).toBe(false);
  });

  test("no clicks or no elapsed time is never on pace", () => {
    expect(onPaceToReachLimit(0, 1000, resetsAt, new Date(2026, 10, 11))).toBe(false);
    expect(onPaceToReachLimit(800, 1000, resetsAt, new Date(2026, 10, 1))).toBe(false);
  });
});
