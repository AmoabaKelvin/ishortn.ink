import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import path from "node:path";

import { render } from "@react-email/components";
import { createElement, type FunctionComponent } from "react";

import { env } from "@/env.mjs";
import { PLAN_CAPS } from "@/lib/billing/plans";
import { ACTIVE_PROMO } from "@/lib/billing/promo";
import { PLAN_PRICES_ANNUAL_USD, PLAN_PRICES_USD } from "@/lib/constants/plan-pricing";
import { eventUsageUpgrade } from "@/server/lib/notifications/event-usage";
import { promoPausedNoticeUrl } from "@/server/lib/notifications/promo-paused-notice";
import { renderEmail } from "@/server/lib/notifications/render-email";
import { scheduledReportEmailProps } from "@/server/lib/notifications/scheduled-report";
import { upgradeNudgeEmailProps } from "@/server/lib/notifications/upgrade-nudge";
import {
  weeklySummaryEmailProps,
  type WeeklySummaryContent,
} from "@/server/lib/notifications/weekly-summary";

import { EmailLayout, EMAIL_POSTAL_ADDRESS } from "./_components/layout";
import { planGraceSubject } from "./_components/plan-grace-subject";
import EventUsageAlertEmail, { eventUsageSubject } from "./event-usage-alert";
import FirstLinkNudgeEmail from "./first-link-nudge";
import PlanGraceEmail, { type PlanGraceEmailProps } from "./plan-grace";
import PromoPausedNoticeEmail, { promoPausedNoticeSubject } from "./promo-paused-notice";
import ScheduledReportEmail, { comparePeriods, scheduledReportSubject } from "./scheduled-report";
import UpgradeNudgeEmail, {
  UPGRADE_NUDGE_PREVIEWS,
  upgradeNudgeSubject,
  type UpgradeNudgeEmailProps,
} from "./upgrade-nudge";
import WeeklySummaryEmail, {
  compareWeeks,
  pausedCopy,
  upgradeCopy,
  weeklySummaryPreview,
  weeklySummarySubject,
} from "./weekly-summary";
import WelcomeEmail from "./welcome";

type Template = FunctionComponent<object> & { PreviewProps?: object };

const files = readdirSync(import.meta.dir).filter(
  (file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"),
);

describe("email templates", () => {
  test("every template is covered", () => {
    expect(files.length).toBe(23);
  });

  for (const file of files) {
    test(`${file} renders in the shared layout`, async () => {
      const mod: { default: Template } = await import(path.join(import.meta.dir, file));
      const Template = mod.default;
      expect(Template.PreviewProps).toBeDefined();

      const html = await render(createElement(Template, Template.PreviewProps));

      // Header, dark-mode support and footer from EmailLayout
      expect(html).toContain('src="https://ishortn.ink/email/logo-tile@2x.png"');
      expect(html).toContain(">iShortn</a>");
      expect(html).toContain("https://ishortn.ink/dashboard");
      expect(html).toContain('<meta name="color-scheme" content="light dark"/>');
      expect(html).toContain("prefers-color-scheme: dark");
      expect(html).toContain("Questions? Reply to this email.");
      expect(html).toContain(EMAIL_POSTAL_ADDRESS);
      // No fixed widths that could overflow a 390px screen
      expect(html).not.toMatch(/(?<![-\w])width:\s*\d{3,}px/);
      // Campaign tags live on the short links, never in template URLs
      expect(html).not.toMatch(/href="[^"]*utm_/);
    });

    test(`${file} sends a clean plain-text part`, async () => {
      const mod: { default: Template } = await import(path.join(import.meta.dir, file));
      const Template = mod.default;
      const { text } = await renderEmail(
        createElement(Template, Template.PreviewProps),
        "ama@example.com",
      );

      expect(text).not.toMatch(/[\u00A0\u200B-\u200F\uFEFF]{2,}/);
      const urls = text.match(/https?:\/\/\S+/g) ?? [];
      expect(urls).toEqual([...new Set(urls)]);
      expect(text).toContain("Sent to ama@example.com.");
      expect(text).toEndWith(EMAIL_POSTAL_ADDRESS);
    });
  }
});

describe("email layout", () => {
  test("a system email shows its eyebrow and headline", async () => {
    const html = await render(
      createElement(
        EmailLayout,
        {
          preview: "Your week",
          eyebrow: "Weekly summary · 16-22 Nov",
          headline: "1,284 clicks",
        },
        null,
      ),
    );

    expect(html).toContain("Weekly summary · 16-22 Nov");
    expect(html).toContain("text-transform:uppercase");
    expect(html).toMatch(/<h1[^>]*>1,284 clicks<\/h1>/);
  });

  test("a letter opens with the first name and has no headline", async () => {
    const html = await render(
      createElement(
        EmailLayout,
        {
          preview: "A note",
          variant: "letter",
          recipientName: "Ama Osei",
        },
        null,
      ),
    );

    expect(html).toContain("Hi <!-- -->Ama<!-- -->,");
    expect(html).not.toContain("<h1");
  });
});

describe("first link nudge", () => {
  test("links to link and QR creation and offers a way to turn it off", async () => {
    const html = await render(createElement(FirstLinkNudgeEmail, FirstLinkNudgeEmail.PreviewProps));

    expect(html).toContain("Create your first link");
    expect(html).toContain('href="https://ishortn.ink/e-nudge-link"');
    expect(html).toContain("Prefer a QR code?");
    expect(html).toContain('href="https://ishortn.ink/e-nudge-qr"');
    expect(html).toContain("The iShortn team");
    expect(html).toContain("Email settings");
  });

  test("greets users stored without a real name as there", async () => {
    for (const userName of [null, "null null"]) {
      const html = await render(
        createElement(FirstLinkNudgeEmail, { ...FirstLinkNudgeEmail.PreviewProps, userName }),
      );

      expect(html).toContain("Hi <!-- -->there<!-- -->,");
      expect(html).not.toContain("null");
    }
  });

  test("drops a literal null part from the greeting", async () => {
    const html = await render(
      createElement(FirstLinkNudgeEmail, {
        ...FirstLinkNudgeEmail.PreviewProps,
        userName: "Ama null",
      }),
    );

    expect(html).toContain("Hi <!-- -->Ama<!-- -->,");
    expect(html).not.toContain("null");
  });
});

describe("welcome", () => {
  const plain = async (props: Parameters<typeof WelcomeEmail>[0]) =>
    (await renderEmail(createElement(WelcomeEmail, props), "ama@example.com")).text.replace(
      /\s+/g,
      " ",
    );

  test("greets by first name, points at creating a link and signs off as the founder", async () => {
    const html = await render(createElement(WelcomeEmail, WelcomeEmail.PreviewProps));
    const text = await plain(WelcomeEmail.PreviewProps);

    expect(text).toStartWith(
      "Paste a long URL, get a short link and a QR code. Here is where to start. Hi Ama,",
    );
    expect(html).toContain('href="https://ishortn.ink/e-welcome-link"');
    expect(html).toContain(">Create a link</a>");
    expect(html).toContain('href="https://ishortn.ink/e-welcome-domains"');
    expect(html).toContain('href="https://ishortn.ink/e-welcome-qr"');
    expect(text).toContain("reply to this email. A person reads every reply.");
    expect(text).toContain("Kelvin Founder, iShortn");
  });

  test("has no hire paragraph, personal site, hard-coded address, exclamation or em dash", async () => {
    const html = await render(createElement(WelcomeEmail, WelcomeEmail.PreviewProps));
    const text = await plain(WelcomeEmail.PreviewProps);

    expect(html).not.toMatch(/for hire|kelvinamoaba|Developer|mailto:|@ishortn\.ink/i);
    expect(text).not.toMatch(/[!\u2014]/);
  });

  test("greets users without a real name as there and signs off as the team without a founder", async () => {
    for (const userName of [null, "", "null null"]) {
      const text = await plain({ userName, founderName: null });

      expect(text).toContain("Hi there,");
      expect(text).not.toContain("null");
      expect(text).toContain("The iShortn team");
      expect(text).not.toContain("Founder");
    }
  });
});

describe("promo paused notice", () => {
  test("a Free account under Pro's allowance is offered Pro with the promo", async () => {
    const props = PromoPausedNoticeEmail.PreviewProps;
    const html = await render(createElement(PromoPausedNoticeEmail, props));

    expect(promoPausedNoticeSubject(props)).toBe(
      "1,284 clicks haven't been tracked since November 20",
    );
    expect(html).toMatch(/<h1[^>]*>Click tracking is paused until December 1<\/h1>/);
    expect(html).toContain("Your links still work. Tracking resumes on its own on December 1.");
    expect(html).toContain(
      "Free plan&#x27;s <!-- -->1,000<!-- --> tracked clicks for this month on <!-- -->November 20",
    );
    expect(html).toContain("<!-- -->1,284 clicks<!-- --> reached your links");
    expect(html).toContain("Pro includes 10,000 tracked clicks a month");
    expect(html).toContain(
      "Black Friday: Pro is 20% off your first year until Tuesday 1 December.",
    );
    expect(html).toContain("Upgrade to Pro");
    expect(html).toContain('href="https://ishortn.ink/e-paused-pro"');
    expect(html).toContain("Email settings");
  });

  test("one untracked click is singular", () => {
    expect(promoPausedNoticeSubject({ dropped: 1, pausedOn: "November 20" })).toBe(
      "1 click hasn't been tracked since November 20",
    );
  });

  test("an account over Pro's allowance is offered Ultra", async () => {
    const html = await render(
      createElement(PromoPausedNoticeEmail, {
        ...PromoPausedNoticeEmail.PreviewProps,
        dropped: 12_000,
        upgrade: {
          plan: "ultra",
          label: "Upgrade to Ultra",
          url: promoPausedNoticeUrl("ultra"),
        },
      }),
    );

    expect(html).toContain("Ultra has no monthly limit on tracked clicks");
    expect(html).toContain("Black Friday: Ultra is 20% off your first year");
    expect(html).toContain("Upgrade to Ultra");
    expect(html).toContain('href="https://ishortn.ink/e-paused-ultra"');
    expect(html).not.toContain("Pro includes");
  });
});

describe("weekly summary", () => {
  const content = {
    weekLabel: "16-22 Nov",
    clicks: 1_284,
    previousClicks: 1_043,
    topLinks: [
      { shortUrl: "ishortn.ink/spring-launch", name: "Spring launch", clicks: 742 },
      { shortUrl: "go.acme.com/menu", name: null, clicks: 318 },
    ],
    topCountry: { name: "Ghana", clicks: 611 },
    topSource: { name: "Instagram", clicks: 402 },
    upgrade: null,
  };
  const html = (upgrade: WeeklySummaryContent["upgrade"] = null) =>
    render(
      createElement(WeeklySummaryEmail, weeklySummaryEmailProps("user_1", { ...content, upgrade })),
    );

  test("the subject carries the week's change", () => {
    expect(weeklySummarySubject(1_284, 1_043)).toBe(
      "Your links got 1,284 clicks last week, up 23%",
    );
    expect(weeklySummarySubject(50, 100)).toBe("Your links got 50 clicks last week, down 50%");
    expect(weeklySummarySubject(30, 1)).toBe("Your links got 30 clicks last week, up 2,900%");
  });

  test("the subject leaves out the change when it is 0% or there is no prior week", () => {
    expect(weeklySummarySubject(10, 10)).toBe("Your links got 10 clicks last week");
    expect(weeklySummarySubject(1_001, 1_000)).toBe("Your links got 1,001 clicks last week");
    expect(weeklySummarySubject(10, 0)).toBe("Your links got 10 clicks last week");
    expect(weeklySummarySubject(1, 0)).toBe("Your links got 1 click last week");
  });

  test("the preheader names the top link and country", () => {
    expect(weeklySummaryPreview(content)).toBe(
      "Top link: Spring launch with 742 clicks. Most clicks came from Ghana.",
    );
    expect(
      weeklySummaryPreview({
        ...content,
        topLinks: [{ shortUrl: "go.acme.com/menu", name: null, clicks: 1 }],
        topCountry: null,
      }),
    ).toBe("Top link: go.acme.com/menu with 1 click.");
  });

  test("shows the eyebrow, totals, top links, country, source and the analytics button", async () => {
    const page = await html();

    expect(page).toContain("Weekly summary · 16-22 Nov");
    expect(page).toContain("Top link: Spring launch with 742 clicks.");
    expect(page).toContain("1,284 clicks");
    expect(page).toContain("Up 23% from 1,043 the week before.");
    expect(page).toContain("Spring launch");
    expect(page).toContain("ishortn.ink/spring-launch");
    expect(page).toContain("go.acme.com/menu");
    expect(page).toContain("742");
    expect(page).toContain("<strong>Ghana</strong>");
    expect(page).toContain("<strong>Instagram</strong>");
    const plain = await render(
      createElement(WeeklySummaryEmail, weeklySummaryEmailProps("user_1", content)),
      { plainText: true },
    );
    expect(plain.replace(/\s+/g, " ")).toContain(
      "Most clicks came from Ghana (611) and Instagram (402).",
    );
    expect(page).toContain(">View analytics</a>");
    expect(page).toContain('href="https://ishortn.ink/e-weekly-analytics"');
    expect(page).toContain("Email settings");
    expect(page).not.toContain("Track every click");
    expect(page).not.toContain("Upgrade to Pro");
    expect(page).not.toContain("Hi Ama");
  });

  test("a paused Free account gets the untracked clicks and the upgrade as the main button", async () => {
    const page = await html({ reason: "paused", count: 342 });

    expect(page).toContain("342 clicks this month weren&#x27;t tracked.");
    expect(page).toContain(
      "Free includes 1,000 tracked clicks a month and your links passed that. Pro includes 10,000.",
    );
    expect(page).toContain('href="https://ishortn.ink/e-weekly-paused"');
    expect(page).toContain(">Track every click</a>");
    expect(page).not.toContain(">View analytics</a>");
    expect(page).not.toContain("Upgrade to Pro");
    // The analytics link stays, as text under the button.
    expect(page).toContain("open your analytics");
    expect(page).toContain('href="https://ishortn.ink/e-weekly-analytics"');
    expect(page.indexOf("e-weekly-paused")).toBeLessThan(page.indexOf("e-weekly-analytics"));
  });

  test("a Free account at 60%+ of the cap gets its usage with a link to Pro", async () => {
    const page = await html({ reason: "cap", count: 640 });

    expect(page).toContain("You&#x27;ve used 640 of 1,000 tracked clicks this month.");
    expect(page).toContain("Upgrade to Pro");
    expect(page).toContain("for 10,000 a month.");
    expect(page).toContain('href="https://ishortn.ink/e-weekly-cap"');
    expect(page).toContain(">View analytics</a>");
    expect(page).not.toContain("hidden on the Free plan");
  });

  test("a Free account with older clicks gets the hidden-history line with a link to Pro", async () => {
    const page = await html({ reason: "history", count: 2_418 });

    expect(page).toContain("2,418 clicks older than 7 days are hidden on the Free plan.");
    expect(page).toContain("to see your full history.");
    expect(page).toContain('href="https://ishortn.ink/e-weekly-history"');
    expect(page).toContain(">View analytics</a>");
    expect(page).not.toContain("tracked clicks this month");
  });

  test("the copy handles one click", () => {
    expect(upgradeCopy({ reason: "history", count: 1 }).lead).toBe(
      "1 click older than 7 days is hidden on the Free plan.",
    );
    expect(pausedCopy(1).lead).toBe("1 click this month wasn't tracked.");
  });

  test("has no exclamation marks or em dashes in any state", async () => {
    for (const upgrade of [
      null,
      { reason: "paused", count: 342 },
      { reason: "cap", count: 640 },
      { reason: "history", count: 2_418 },
    ] as const) {
      const text = await render(
        createElement(
          WeeklySummaryEmail,
          weeklySummaryEmailProps("user_1", { ...content, upgrade }),
        ),
        { plainText: true },
      );
      expect(text).not.toMatch(/[!\u2014]/);
    }
  });

  test("the footer offers a one-click unsubscribe for the weekly summary", async () => {
    const page = await render(createElement(WeeklySummaryEmail, WeeklySummaryEmail.PreviewProps));

    expect(page).toContain("Unsubscribe");
    expect(page).toContain("/api/email/unsubscribe?token=user_1.sig&amp;list=weekly-summary");
    expect(page).toContain("You received this weekly summary");
  });

  test("compares the week with the one before", () => {
    expect(compareWeeks(10, 0)).toBe("Your links had no clicks the week before.");
    expect(compareWeeks(10, 10)).toBe("The same as the week before.");
    expect(compareWeeks(5, 10)).toBe("Down 50% from 10 the week before.");
    expect(compareWeeks(1_001, 1_000)).toBe("Up less than 1% from 1,000 the week before.");
    expect(compareWeeks(30, 1)).toBe("Up 2,900% from 1 the week before.");
  });
});

describe("upgrade nudge", () => {
  // Plain text wraps at 80 columns; collapse it so sentences can be matched whole.
  const plain = async (props: UpgradeNudgeEmailProps) =>
    (await render(createElement(UpgradeNudgeEmail, props), { plainText: true })).replace(
      /\s+/g,
      " ",
    );
  const html = (props: UpgradeNudgeEmailProps) => render(createElement(UpgradeNudgeEmail, props));

  const expected = {
    limit_hit: {
      subject: "Custom domains is part of Pro",
      paragraph: "On 21 November you tried custom domains. That comes with Pro.",
    },
    events: {
      subject: "Your links are on pace to pass 1,000 tracked clicks this month",
      paragraph:
        "Free includes 1,000 tracked clicks a month. Your links are at 640, so at this pace they'll pass it around 27 November. After that they keep working, but new clicks won't show in your analytics until the count resets on 1 December. Pro includes 10,000 tracked clicks a month.",
    },
    links: {
      subject: "You've used 18 of your 30 free links this month",
      paragraph:
        "Free includes 30 new links a month and you've used 18. Your count resets on 1 December. Pro includes 1,000 new links a month.",
    },
    analytics: {
      subject: "Your first clicks are leaving the 7-day view",
      paragraph:
        "Free shows the last 7 days of clicks. Your first clicks came in on 19 November, so they drop out of your dashboard on 26 November. Pro shows all of them.",
    },
    domain: {
      subject: "Your links could be on your own domain",
      paragraph:
        "With Pro your links can use your own domain, like go.yourbrand.com, instead of ours. You can connect up to 3.",
    },
  };

  for (const props of Object.values(UPGRADE_NUDGE_PREVIEWS)) {
    test(`${props.angle.reason}: subject, angle paragraph, preview text and the price`, async () => {
      const want = expected[props.angle.reason];
      const text = await plain(props);

      expect(upgradeNudgeSubject(props.angle)).toBe(want.subject);
      expect(text).toContain(want.paragraph);
      // The preview text is the paragraph's first sentence, so it leads the plain-text body.
      expect(text.trimStart()).toStartWith(
        want.paragraph.slice(0, want.paragraph.indexOf(".") + 1),
      );
      expect(text).toContain("Hi Ama,");
      expect(text).toContain(
        `Pro is $${PLAN_PRICES_USD.pro} a month, or $${PLAN_PRICES_ANNUAL_USD.pro} a year.`,
      );
      expect(text).toContain("Compare plans");
      expect(text).toContain("I won't send you this email again. Kelvin");
      expect(text).not.toContain("isht.ink");
    });
  }

  test("the analytics angle once the first clicks are out of view", async () => {
    const props = UPGRADE_NUDGE_PREVIEWS.analytics;
    const angle = { ...props.angle, ended: true };

    expect(upgradeNudgeSubject(angle)).toBe("Your first clicks are outside the 7-day view");
    expect(await plain({ ...props, angle })).toContain(
      "Free shows the last 7 days of clicks, so your clicks from before 16 November are already out of view. Pro shows all of them.",
    );
  });

  const content = {
    name: "Ama",
    signupDate: "18 November",
    linkCount: 1,
    clickCount: 1,
    angle: { reason: "domain" as const },
  };
  const beforePromo = new Date("2026-11-23T12:00:00Z");

  test("states links and clicks, and leaves clicks out when there are none", async () => {
    expect(await plain(upgradeNudgeEmailProps("user_1", content, beforePromo))).toContain(
      "You've made 1 link since you joined iShortn on 18 November, and they've had 1 click so far.",
    );
    expect(
      await plain(
        upgradeNudgeEmailProps(
          "user_1",
          { ...content, linkCount: 1_204, clickCount: 25_310 },
          beforePromo,
        ),
      ),
    ).toContain(
      "You've made 1,204 links since you joined iShortn on 18 November, and they've had 25,310 clicks so far.",
    );
    const none = await plain(
      upgradeNudgeEmailProps("user_1", { ...content, clickCount: 0 }, beforePromo),
    );
    expect(none).toContain("You've made 1 link since you joined iShortn on 18 November.");
    expect(none).not.toContain("so far");
  });

  test("shows the promo line only inside the promo window", async () => {
    const at = (iso: string) => plain(upgradeNudgeEmailProps("user_1", content, new Date(iso)));

    expect(await at("2026-11-26T12:00:00Z")).toContain(
      "Black Friday: Pro is 20% off your first year until Tuesday 1 December. The discount is applied at checkout.",
    );
    expect(await at("2026-11-23T12:00:00Z")).not.toContain("Black Friday");
    expect(await at("2026-12-02T00:00:00Z")).not.toContain("Black Friday");
  });

  test("the CTA is the tracked link for its angle, and the footer unsubscribes", async () => {
    const secret = env.EMAIL_UNSUBSCRIBE_SECRET;
    Object.assign(env, { EMAIL_UNSUBSCRIBE_SECRET: "u".repeat(32) });
    try {
      const props = upgradeNudgeEmailProps(
        "user_1",
        { ...content, angle: { reason: "links", monthlyLinkCount: 16, resetDate: "1 December" } },
        beforePromo,
      );
      const rendered = await html(props);

      expect(props.upgradeUrl).toBe("https://ishortn.ink/e-upgrade-links");
      expect(rendered).toContain(`href="${props.upgradeUrl}"`);
      expect(props.unsubscribeUrl).toStartWith(
        "https://ishortn.ink/api/email/unsubscribe?token=user_1.",
      );
      expect(rendered).toContain(">Unsubscribe</a>");
      expect(rendered).toContain("Email settings");
      expect(rendered).toContain(
        "You&#x27;re getting this one-time email because you have an iShortn account with product emails turned on.",
      );
      expect(rendered).not.toContain("isht.ink");
    } finally {
      Object.assign(env, { EMAIL_UNSUBSCRIBE_SECRET: secret });
    }
  });
});

describe("scheduled report", () => {
  const props = ScheduledReportEmail.PreviewProps;

  test("subject names the period type, target, clicks and change", () => {
    expect(scheduledReportSubject(props)).toBe(
      "Monthly report for Acme Studio client links: 4,812 clicks, up 23%",
    );
    expect(
      scheduledReportSubject({ ...props, frequency: "weekly", clicks: 1, previousClicks: 0 }),
    ).toBe("Weekly report for Acme Studio client links: 1 click");
  });

  test("compares with the period before in words", () => {
    expect(comparePeriods(4_812, 3_907, "monthly")).toBe("Up 23% from 3,907 the month before.");
    expect(comparePeriods(5, 10, "weekly")).toBe("Down 50% from 10 the week before.");
    expect(comparePeriods(3, 3, "weekly")).toBe("The same as the week before.");
    expect(comparePeriods(3, 0, "weekly")).toBe("No clicks the week before.");
    expect(comparePeriods(0, 0, "monthly")).toBe("No clicks the month before either.");
  });

  test("a recipient gets an unsubscribe link and no account settings", async () => {
    const html = await render(createElement(ScheduledReportEmail, props));
    expect(html).toContain("Monthly folder report · October 2026");
    expect(html).toContain("Ama Mensah set up a monthly report for Acme Studio client links.");
    expect(html).toContain(">Unsubscribe</a>");
    expect(html).not.toContain("Email settings");
    expect(html).toContain("Top countries");
    expect(html).toContain("go.acmestudio.com/menu");
  });

  test("links the public stats page only when sharing is on", async () => {
    const without = await render(createElement(ScheduledReportEmail, props));
    expect(without).not.toContain("View live stats");

    const statsUrl = "https://ishortn.ink/stats/abc123";
    const shared = await render(createElement(ScheduledReportEmail, { ...props, statsUrl }));
    expect(shared).toContain("View live stats");
    expect(shared).toContain(`href="${statsUrl}"`);
  });

  test("a period without clicks leaves out the breakdowns", async () => {
    const html = await render(
      createElement(ScheduledReportEmail, {
        ...props,
        clicks: 0,
        previousClicks: 0,
        topLinks: [],
        countries: [],
        devices: [],
        sources: [],
      }),
    );
    expect(html).toContain("0 clicks");
    expect(html).not.toContain("Top countries");
    expect(html).not.toContain("Top links");
  });

  test("each recipient's unsubscribe link is signed for that report and address", () => {
    const previous = env.EMAIL_UNSUBSCRIBE_SECRET;
    Object.assign(env, { EMAIL_UNSUBSCRIBE_SECRET: "s".repeat(32) });
    try {
      const { unsubscribeUrl } = scheduledReportEmailProps(12, "client@example.com", props);
      expect(unsubscribeUrl).toStartWith(
        "https://ishortn.ink/api/email/unsubscribe?token=12%3Aclient%40example.com.",
      );
      expect(unsubscribeUrl).toEndWith("&list=scheduled-report");
    } finally {
      Object.assign(env, { EMAIL_UNSUBSCRIBE_SECRET: previous });
    }
  });
});

describe("cap, grace, promo-paused and upgrade-nudge copy", () => {
  const eventUsage = (["free", "pro"] as const).flatMap((plan) =>
    [80, 90, 100].flatMap((threshold) =>
      [ACTIVE_PROMO, null].flatMap((promo) =>
        [true, false].map((onPaceToReachLimit) => {
          const limit = PLAN_CAPS[plan].eventsLimit ?? 0;
          const upgrade = eventUsageUpgrade(plan, threshold);
          if (!upgrade) throw new Error(`no upgrade for ${plan}`);
          const props = {
            ...EventUsageAlertEmail.PreviewProps,
            plan,
            threshold,
            limit,
            currentCount: Math.round((limit * threshold) / 100),
            onPaceToReachLimit,
            upgrade,
            promo,
          };
          return {
            name: `event usage ${plan} ${threshold}%`,
            subject: eventUsageSubject(props),
            element: createElement(EventUsageAlertEmail, props),
          };
        }),
      ),
    ),
  );

  const promoPaused = (["pro", "ultra"] as const).map((plan) => {
    const props = {
      ...PromoPausedNoticeEmail.PreviewProps,
      upgrade: { plan, label: `Upgrade to ${plan}`, url: promoPausedNoticeUrl(plan) },
    };
    return {
      name: `promo paused ${plan}`,
      subject: promoPausedNoticeSubject(props),
      element: createElement(PromoPausedNoticeEmail, props),
    };
  });

  const planGrace = (["started", "reminder", "ended"] as const).flatMap((kind) =>
    (["lapsed", "over_plan", "team"] as const).flatMap((reason) =>
      [undefined, "https://ishortn.ink/dashboard/settings/billing/update-payment"].map(
        (updatePaymentUrl) => {
          const props: PlanGraceEmailProps = {
            ...PlanGraceEmail.PreviewProps,
            kind,
            reason,
            teamName: "Acme",
            updatePaymentUrl,
          };
          return {
            name: `plan grace ${kind} ${reason}${updatePaymentUrl ? " payment failed" : ""}`,
            subject: planGraceSubject(props),
            element: createElement(PlanGraceEmail, props),
          };
        },
      ),
    ),
  );

  const upgradeNudge = Object.values(UPGRADE_NUDGE_PREVIEWS).map(
    (props: UpgradeNudgeEmailProps) => ({
      name: `upgrade nudge ${props.angle.reason}`,
      subject: upgradeNudgeSubject(props.angle),
      element: createElement(UpgradeNudgeEmail, props),
    }),
  );

  for (const email of [...eventUsage, ...promoPaused, ...planGrace, ...upgradeNudge]) {
    test(`${email.name}: no exclamation marks, em dashes or old wording`, async () => {
      // The plain-text part carries the preview text and the body.
      const { text } = await renderEmail(email.element, "ama@example.com");
      for (const copy of [email.subject, text]) {
        expect(copy).not.toContain("!");
        expect(copy).not.toContain("\u2014");
        expect(copy.toLowerCase()).not.toContain("analytics events");
        expect(copy.toLowerCase()).not.toMatch(/\bvisits?\b/);
        expect(copy).not.toContain("Heads up");
        expect(copy).not.toContain("Thanks for using iShortn");
      }
    });
  }
});
