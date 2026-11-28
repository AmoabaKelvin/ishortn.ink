import { describe, expect, it } from "bun:test";

import { PLAN_CAPS } from "@/lib/billing/plans";
import { isPostLive } from "@/lib/blog";
import { PLAN_PRICES_ANNUAL_USD, PLAN_PRICES_USD } from "@/lib/constants/plan-pricing";
import { DOCS_PAGES, docsHref } from "@/lib/docs/navigation";
import { competitors } from "@/lib/seo/competitors";
import { MAX_CSV_IMPORT_ROWS } from "@/server/api/routers/link/utils";
import { MAX_REPORT_RECIPIENTS } from "@/server/api/routers/scheduled-report/scheduled-report.input";

import { getSolution, solutionList, solutions, usd } from "./solutions";

import type { Solution } from "./solutions";

// Every string a solution page renders.
const copyOf = (s: Solution): string[] => [
  s.name,
  s.footerLabel,
  s.hubBlurb,
  s.metaTitle,
  s.metaDescription,
  s.eyebrow,
  s.h1,
  s.subhead,
  ...s.heroPoints,
  s.heroCta,
  s.benefitsTitle,
  ...s.benefits.flatMap((b) => [b.title, b.body]),
  s.howToTitle,
  ...s.howTo.flatMap((step) => [step.title, step.body]),
  ...s.plans.flatMap((plan) => [plan.title, plan.body]),
  s.plansNote ?? "",
  ...s.faqs.flatMap((faq) => [faq.question, faq.answer]),
  ...s.related.map((link) => link.label),
  s.ctaTitle,
  s.ctaBody,
  s.ctaButton,
];

const allCopy = solutionList.flatMap(copyOf).join("\n");
const matches = (pattern: RegExp) => [...allCopy.matchAll(pattern)].map((m) => m[1]);

describe("solution copy", () => {
  it("only quotes current plan prices", () => {
    const prices = new Set([
      ...Object.values(PLAN_PRICES_USD).map(usd),
      ...Object.values(PLAN_PRICES_ANNUAL_USD).flatMap((annual) => [usd(annual), usd(annual / 12)]),
    ]);
    const quoted = matches(/(\$\d+(?:\.\d+)?)/g);
    expect(quoted.length).toBeGreaterThan(0);
    for (const price of quoted) expect(prices).toContain(price);

    const restaurants = copyOf(solutions.restaurants).join("\n");
    expect(restaurants).toContain(`Pro is ${usd(PLAN_PRICES_USD.pro)} a month`);
    expect(restaurants).toContain(`Ultra, ${usd(PLAN_PRICES_USD.ultra)} a month`);

    const agencies = copyOf(solutions.agencies).join("\n");
    expect(agencies).toContain(`Pro, ${usd(PLAN_PRICES_USD.pro)} a month`);
    expect(agencies).toContain(`Ultra, ${usd(PLAN_PRICES_USD.ultra)} a month`);
  });

  it("only quotes the current paid plan and import limits", () => {
    for (const n of matches(/(\d+) custom domains/g))
      expect(Number(n)).toBe(PLAN_CAPS.pro.domainLimit);
    for (const n of matches(/up to (\d+) of them/g))
      expect(Number(n)).toBe(PLAN_CAPS.pro.folderLimit);
    const csvRows = matches(/up to ([\d,]+) links per CSV file/g);
    expect(csvRows.length).toBeGreaterThan(0);
    for (const n of csvRows) expect(n).toBe(MAX_CSV_IMPORT_ROWS.toLocaleString("en-US"));
  });

  it("only quotes the current email report limits", () => {
    const reports = matches(/Pro includes (\d+) reports/g);
    expect(reports.length).toBeGreaterThan(0);
    for (const n of reports) expect(Number(n)).toBe(PLAN_CAPS.pro.scheduledReportLimit);

    const recipients = matches(/up to (\d+) (?:people|addresses)/g);
    expect(recipients.length).toBeGreaterThan(0);
    for (const n of recipients) expect(Number(n)).toBe(MAX_REPORT_RECIPIENTS);
  });

  it("only quotes current free plan limits", () => {
    const qrCodes = matches(/(\d+) dynamic (?:QR )?codes/g);
    expect(qrCodes.length).toBeGreaterThan(0);
    for (const n of qrCodes) expect(Number(n)).toBe(PLAN_CAPS.free.qrCodeLimit);

    const links = matches(/(\d+) (?:free links|on Free)/g);
    expect(links.length).toBeGreaterThan(0);
    for (const n of links) expect(Number(n)).toBe(PLAN_CAPS.free.linksLimit);

    for (const n of matches(/last (\d+) days/g)) {
      expect(Number(n)).toBe(PLAN_CAPS.free.analyticsRangeLimitDays);
    }
  });

  it("keys each solution by its slug", () => {
    for (const [key, solution] of Object.entries(solutions)) expect(solution.slug).toBe(key);
    expect(getSolution("restaurants")).toBe(solutions.restaurants);
    expect(getSolution("creators")).toBe(solutions.creators);
    expect(getSolution("agencies")).toBe(solutions.agencies);
    expect(getSolution("events")).toBe(solutions.events);
    expect(getSolution("churches-and-nonprofits")).toBe(solutions["churches-and-nonprofits"]);
    expect(getSolution("real-estate")).toBe(solutions["real-estate"]);
    expect(getSolution("small-business")).toBe(solutions["small-business"]);
    expect(getSolution("unknown")).toBeUndefined();
  });

  // A mistyped blog slug would hide the link forever instead of failing.
  it("links only to existing docs pages, blog posts, comparison pages, the QR code generator and customer stories", () => {
    const docs = new Set([
      ...DOCS_PAGES.map((page) => docsHref(page.slug)),
      ...Object.values(competitors).map((competitor) => `/compare/${competitor.slug}`),
      "/qr-code-generator",
      "/whatsapp-link-generator",
      "/customers/airo",
    ]);
    const farFuture = new Date("2100-01-01");
    for (const { href } of solutionList.flatMap((solution) => solution.related)) {
      if (href.startsWith("/blog/")) expect(isPostLive(href.slice(6), farFuture)).toBe(true);
      else expect(docs).toContain(href);
    }
  });
});
