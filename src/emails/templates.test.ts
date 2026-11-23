import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import path from "node:path";

import { render } from "@react-email/components";
import { createElement, type FunctionComponent } from "react";

import { ACTIVE_PROMO } from "@/lib/billing/promo";
import { promoPausedNoticeUrl } from "@/server/lib/notifications/promo-paused-notice";

import FirstLinkNudgeEmail from "./first-link-nudge";
import PromoPausedNoticeEmail from "./promo-paused-notice";

type Template = FunctionComponent<object> & { PreviewProps?: object };

const files = readdirSync(import.meta.dir).filter(
  (file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"),
);

describe("email templates", () => {
  test("every template is covered", () => {
    expect(files.length).toBe(18);
  });

  for (const file of files) {
    test(`${file} renders in the shared layout`, async () => {
      const mod: { default: Template } = await import(path.join(import.meta.dir, file));
      const Template = mod.default;
      expect(Template.PreviewProps).toBeDefined();

      const html = await render(createElement(Template, Template.PreviewProps));

      // Logo and footer from EmailLayout
      expect(html).toContain('alt="iShortn"');
      expect(html).toContain('src="https://ishortn.ink/email/logo@2x.png"');
      expect(html).toContain("mailto:support@ishortn.ink");
      expect(html).toContain("https://ishortn.ink/dashboard");
      // No fixed widths that could overflow a 390px screen
      expect(html).not.toMatch(/(?<![-\w])width:\s*\d{3,}px/);
    });
  }
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
    expect(html).toContain("Manage notifications");
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
    expect(html).toContain("Manage notifications");
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
