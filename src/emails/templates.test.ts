import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import path from "node:path";

import { render } from "@react-email/components";
import { createElement, type FunctionComponent } from "react";

import { env } from "@/env.mjs";
import { PLAN_CAPS } from "@/lib/billing/plans";
import { ACTIVE_PROMO } from "@/lib/billing/promo";
import { PLAN_PRICES_ANNUAL_USD, PLAN_PRICES_USD } from "@/lib/constants/plan-pricing";
import { promoPausedNoticeUrl } from "@/server/lib/notifications/promo-paused-notice";
import { renderEmail } from "@/server/lib/notifications/render-email";
import { upgradeNudgeEmailProps } from "@/server/lib/notifications/upgrade-nudge";
import { weeklySummaryEmailProps } from "@/server/lib/notifications/weekly-summary";

import { EmailLayout, EMAIL_POSTAL_ADDRESS } from "./_components/layout";
import FirstLinkNudgeEmail from "./first-link-nudge";
import PromoPausedNoticeEmail from "./promo-paused-notice";
import UpgradeNudgeEmail, {
  UPGRADE_NUDGE_PREVIEWS,
  upgradeNudgeSubject,
  type UpgradeNudgeEmailProps,
} from "./upgrade-nudge";
import WeeklySummaryEmail, { compareWeeks, upgradeCopy } from "./weekly-summary";

type Template = FunctionComponent<object> & { PreviewProps?: object };

const files = readdirSync(import.meta.dir).filter(
  (file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"),
);

describe("email templates", () => {
  test("every template is covered", () => {
    expect(files.length).toBe(20);
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
    expect(html).toContain(
      "https://ishortn.ink/dashboard/link/new?utm_source=email&amp;utm_medium=lifecycle&amp;utm_campaign=first_link_nudge",
    );
    expect(html).toContain("Prefer a QR code?");
    expect(html).toContain("https://ishortn.ink/dashboard/qrcodes/create?utm_source=email");
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

describe("promo paused notice", () => {
  test("a Free account under Pro's allowance is offered Pro with the promo", async () => {
    const html = await render(
      createElement(PromoPausedNoticeEmail, PromoPausedNoticeEmail.PreviewProps),
    );

    expect(html).toContain("1,284 visits");
    expect(html).toContain("paused since <!-- -->November 20");
    expect(html).toContain("Counting resumes on its own on <!-- -->December 1");
    expect(html).toContain("Pro includes 10,000 analytics events a month");
    expect(html).toContain(
      "Black Friday: Pro is 20% off your first year until Tuesday 1 December.",
    );
    expect(html).toContain("Upgrade to Pro");
    expect(html).toContain(
      "/dashboard/pricing?highlight=pro&amp;source=events_promo_email&amp;utm_source=ishortn&amp;utm_medium=email&amp;utm_campaign=bfcm2026",
    );
    expect(html).toContain("Email settings");
  });

  test("an account over Pro's allowance is offered Ultra", async () => {
    const html = await render(
      createElement(PromoPausedNoticeEmail, {
        ...PromoPausedNoticeEmail.PreviewProps,
        dropped: 12_000,
        upgrade: {
          plan: "ultra",
          label: "Upgrade to Ultra",
          url: promoPausedNoticeUrl("ultra", ACTIVE_PROMO),
        },
      }),
    );

    expect(html).toContain("Ultra has no monthly event cap");
    expect(html).toContain("Black Friday: Ultra is 20% off your first year");
    expect(html).toContain("Upgrade to Ultra");
    expect(html).toContain("highlight=ultra&amp;source=events_promo_email");
    expect(html).not.toContain("Pro includes");
  });
});

describe("weekly summary", () => {
  const content = {
    weekLabel: "November 16 – 22",
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

  test("shows the week's clicks, comparison, top links, country, source and the analytics button", async () => {
    const html = await render(
      createElement(WeeklySummaryEmail, weeklySummaryEmailProps("user_1", "Ama", content)),
    );

    expect(html).toContain("1,284 clicks");
    expect(html).toContain("Up 23% from 1,043 clicks the week before.");
    expect(html).toContain("November 16 – 22");
    expect(html).toContain("Spring launch");
    expect(html).toContain("ishortn.ink/spring-launch");
    expect(html).toContain("go.acme.com/menu");
    expect(html).toContain("742");
    expect(html).toContain("Top country: <strong>Ghana</strong>");
    expect(html).toContain("Top source: <strong>Instagram</strong>");
    expect(html).toContain("View your analytics");
    expect(html).toContain(
      "https://ishortn.ink/dashboard/analytics/overview?utm_source=email&amp;utm_medium=lifecycle&amp;utm_campaign=weekly_summary",
    );
    expect(html).toContain("Email settings");
    expect(html).not.toContain("Upgrade to Pro");
  });

  test("a paused Free account gets the unrecorded-clicks line with a link to Pro", async () => {
    const html = await render(
      createElement(
        WeeklySummaryEmail,
        weeklySummaryEmailProps("user_1", "Ama", {
          ...content,
          upgrade: { reason: "paused", count: 342 },
        }),
      ),
    );

    expect(html).toContain("so 342 clicks this month weren&#x27;t recorded.");
    expect(html).toContain("Upgrade to Pro");
    expect(html).toContain("/dashboard/pricing?highlight=pro&amp;source=weekly_summary&amp;");
  });

  test("a Free account at 60%+ of the cap gets its usage with a link to Pro", async () => {
    const html = await render(
      createElement(
        WeeklySummaryEmail,
        weeklySummaryEmailProps("user_1", "Ama", {
          ...content,
          upgrade: { reason: "cap", count: 640 },
        }),
      ),
    );

    expect(html).toContain("You&#x27;ve used 640 of 1,000 tracked visits this month.");
    expect(html).toContain("Upgrade to Pro");
    expect(html).toContain("for 10,000 a month.");
    expect(html).toContain("/dashboard/pricing?highlight=pro&amp;source=weekly_summary_cap&amp;");
    expect(html).not.toContain("hidden on the Free plan");
  });

  test("a Free account with older clicks gets the hidden-history line with a link to Pro", async () => {
    const html = await render(
      createElement(
        WeeklySummaryEmail,
        weeklySummaryEmailProps("user_1", "Ama", {
          ...content,
          upgrade: { reason: "history", count: 2_418 },
        }),
      ),
    );

    expect(html).toContain("2,418 clicks older than 7 days are hidden on the Free plan.");
    expect(html).toContain("to see your full history.");
    expect(html).toContain(
      "/dashboard/pricing?highlight=pro&amp;source=weekly_summary_history&amp;",
    );
    expect(html).not.toContain("tracked visits this month");
  });

  test("the upgrade copy handles one click", () => {
    expect(upgradeCopy({ reason: "history", count: 1 }).lead).toBe(
      "1 click older than 7 days is hidden on the Free plan.",
    );
    expect(upgradeCopy({ reason: "paused", count: 1 }).lead).toContain("1 click this month wasn't");
  });

  test("the footer offers a one-click unsubscribe for the weekly summary", async () => {
    const html = await render(createElement(WeeklySummaryEmail, WeeklySummaryEmail.PreviewProps));

    expect(html).toContain("Unsubscribe");
    expect(html).toContain("/api/email/unsubscribe?token=user_1.sig&amp;list=weekly-summary");
    expect(html).toContain("You received this weekly summary");
  });

  test("compares the week with the one before", () => {
    expect(compareWeeks(10, 0)).toBe("Your links had no clicks the week before.");
    expect(compareWeeks(10, 10)).toBe("The same as the week before.");
    expect(compareWeeks(5, 10)).toBe("Down 50% from 10 clicks the week before.");
    expect(compareWeeks(1_001, 1_000)).toBe("Up less than 1% from 1,000 clicks the week before.");
    expect(compareWeeks(30, 1)).toBe("Up 2,900% from 1 click the week before.");
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
      paragraph:
        "On 21 November you tried custom domains. That comes with Pro, along with the rest of the list below.",
    },
    events: {
      subject: "Your links are on pace to pass 1,000 clicks this month",
      paragraph:
        "Free records 1,000 clicks a month. Your links are at 640, so at this pace they'll pass it around 27 November. After that your links keep working, but new clicks stop showing in your analytics until the count resets on 1 December.",
    },
    links: {
      subject: "You've used 18 of your 30 free links this month",
      paragraph:
        "Free includes 30 new links a month and you've used 18. Your count resets on 1 December.",
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
    test(`${props.angle.reason}: subject, angle paragraph, preview text and the plan summary`, async () => {
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
      expect(text).toContain(
        `${PLAN_CAPS.pro.linksLimit?.toLocaleString("en-US")} links and ${PLAN_CAPS.pro.eventsLimit?.toLocaleString("en-US")} tracked clicks a month`,
      );
      expect(text).toContain(`${PLAN_CAPS.pro.domainLimit} custom domains`);
      expect(text).toContain("Compare plans");
      expect(text).toContain("we won't send you this email again.");
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

  test("the CTA carries the campaign UTMs and source, and the footer unsubscribes", async () => {
    const secret = env.EMAIL_UNSUBSCRIBE_SECRET;
    Object.assign(env, { EMAIL_UNSUBSCRIBE_SECRET: "u".repeat(32) });
    try {
      const props = upgradeNudgeEmailProps(
        "user_1",
        { ...content, angle: { reason: "links", monthlyLinkCount: 16, resetDate: "1 December" } },
        beforePromo,
      );
      const rendered = await html(props);

      expect(props.upgradeUrl).toBe(
        "https://ishortn.ink/dashboard/pricing?highlight=pro&source=upgrade_nudge&utm_source=lifecycle&utm_medium=email&utm_campaign=upgrade_nudge&utm_content=links",
      );
      expect(rendered).toContain(props.upgradeUrl.replaceAll("&", "&amp;"));
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
