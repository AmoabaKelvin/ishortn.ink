import { FREE_QR_CODE_LIMIT } from "@/lib/billing/entitlements";
import { PLAN_CAPS } from "@/lib/billing/plans";
import { PLAN_PRICES_USD } from "@/lib/constants/plan-pricing";
import { competitors } from "@/lib/seo/competitors";

import type { Competitor } from "@/lib/seo/competitors";

// Data for the /compare hub. Competitor cells come straight from competitors.ts and iShortn cells
// from the billing constants, so neither side can drift from its source of truth.

export type CompareRow = {
  name: string;
  href: string;
  freeLinks: string;
  freeAnalytics: string;
  customDomains: string;
  qrCodes: string;
  pricing: string;
  /** True for iShortn's own row, which the table highlights. */
  isOwn: boolean;
  /** ISO date the vendor's pricing page was last checked; null for iShortn's live prices. */
  checkedOn: string | null;
};

export type CompareTable = {
  category: Competitor["category"];
  title: string;
  caption: string;
  freeLinksLabel: string;
  customDomainsLabel: string;
  rows: CompareRow[];
};

type BillingFacts = {
  caps: typeof PLAN_CAPS;
  prices: typeof PLAN_PRICES_USD;
  freeQrCodes: number;
};

const liveBilling: BillingFacts = {
  caps: PLAN_CAPS,
  prices: PLAN_PRICES_USD,
  freeQrCodes: FREE_QR_CODE_LIMIT,
};

// Undefined caps mean unlimited.
const amount = (limit: number | undefined) =>
  limit === undefined ? "unlimited" : limit.toLocaleString("en-US");

export function ishortnRows({ caps, prices, freeQrCodes }: BillingFacts = liveBilling) {
  const pro = `$${prices.pro}/mo`;
  const shared = {
    name: "iShortn",
    href: "/pricing",
    freeAnalytics: `${amount(caps.free.analyticsRangeLimitDays)} days on Free, 1 year on Pro`,
    qrCodes: `${freeQrCodes} dynamic on Free, never expire`,
    pricing: `Pro ${pro}, Ultra $${prices.ultra}/mo`,
    isOwn: true,
    checkedOn: null,
  };
  const shortener: CompareRow = {
    ...shared,
    freeLinks: `${amount(caps.free.linksLimit)}/month`,
    customDomains: `${amount(caps.pro.domainLimit)} on Pro (${pro}), ${amount(caps.ultra.domainLimit)} on Ultra`,
  };
  const linkInBio: CompareRow = {
    ...shared,
    freeLinks: `${amount(caps.free.bioPageLimit)} on Free (${amount(caps.free.bioLinkBlocksPerPageLimit)} link blocks), ${amount(caps.pro.bioPageLimit)} on Pro, ${amount(caps.ultra.bioPageLimit)} on Ultra`,
    customDomains: `Bio pages on your own domain from Pro (${pro})`,
  };
  return { shortener, linkInBio };
}

const competitorRow = (competitor: Competitor): CompareRow => ({
  name: competitor.name,
  href: `/compare/${competitor.slug}`,
  freeLinks: competitor.freeLinks,
  freeAnalytics: competitor.freeAnalytics,
  customDomains: competitor.customDomains,
  qrCodes: competitor.qrCodes,
  pricing: competitor.pricing,
  isOwn: false,
  checkedOn: competitor.pricesCheckedOn,
});

const competitorRows = (category: Competitor["category"]) =>
  Object.values(competitors)
    .filter((competitor) => competitor.category === category)
    .map(competitorRow);

export function compareTables(billing: BillingFacts = liveBilling): CompareTable[] {
  const ishortn = ishortnRows(billing);
  return [
    {
      category: "URL shortener",
      title: "URL shorteners",
      caption: "Free-plan limits and paid prices of URL shorteners",
      freeLinksLabel: "Free links",
      customDomainsLabel: "Custom domains",
      rows: [ishortn.shortener, ...competitorRows("URL shortener")],
    },
    {
      category: "link in bio",
      title: "Link-in-bio tools",
      caption: "Free-plan limits and paid prices of link-in-bio tools",
      freeLinksLabel: "Bio pages",
      customDomainsLabel: "Custom domain",
      rows: [ishortn.linkInBio, ...competitorRows("link in bio")],
    },
  ];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-22" → "22 Nov 2026", parsed by hand so no timezone or locale can shift it. */
export function formatCheckedOn(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTHS[(month ?? 1) - 1]} ${year}`;
}

export function compareIntro({ caps, prices, freeQrCodes }: BillingFacts = liveBilling) {
  const bioPages =
    caps.free.bioPageLimit === 1
      ? "one link-in-bio page"
      : `${amount(caps.free.bioPageLimit)} link-in-bio pages`;
  return `iShortn Free gives you ${amount(caps.free.linksLimit)} links a month, ${amount(caps.free.analyticsRangeLimitDays)} days of click analytics, ${bioPages} and ${freeQrCodes} dynamic QR codes that never expire. Pro is $${prices.pro} a month and adds ${amount(caps.pro.domainLimit)} custom domains and a full year of detailed analytics. If you need more free links or custom domains on a free plan, Short.io and Dub are more generous; if you want short links, QR codes and a bio page on your own domain for one low price, iShortn is the cheaper option. Every competitor figure below links to its full comparison and shows the date we last checked their pricing page.`;
}

export function compareFaqs({ caps, prices, freeQrCodes }: BillingFacts = liveBilling) {
  const bioPage =
    caps.free.bioPageLimit === 1
      ? "a link-in-bio page"
      : `${amount(caps.free.bioPageLimit)} link-in-bio pages`;
  return [
    {
      question: "What is the best free Bitly alternative?",
      answer: `It depends on what you need from the free plan. Short.io gives the most free links (1,000 in total) and 5 custom domains. Dub gives 25 links a month with 3 custom domains. iShortn gives ${amount(caps.free.linksLimit)} links a month, ${amount(caps.free.analyticsRangeLimitDays)} days of click analytics, ${bioPage} and ${freeQrCodes} dynamic QR codes that never expire, with no ad page before links open. Bitly Free allows 5 links a month with no click data.`,
    },
    {
      question: "What is the cheapest URL shortener with a custom domain?",
      answer: `Short.io and Dub include custom domains on their free plans. Among paid plans, iShortn Pro costs $${prices.pro} a month with ${amount(caps.pro.domainLimit)} custom domains, compared with Bitly Growth at $29 a month billed annually.`,
    },
    {
      question: "Which link-in-bio tool lets me use my own domain?",
      answer: `Linktree doesn't offer custom domains on any plan. Carrd does from its Pro Standard plan at $19 a year. iShortn Pro ($${prices.pro} a month) puts bio pages on your own domain, and the same domain serves your short links and QR codes.`,
    },
    {
      question: "Do iShortn's free QR codes expire?",
      answer: `No. The Free plan includes ${freeQrCodes} dynamic QR codes. You can change where they point at any time, they never expire and they show no ads.`,
    },
    {
      question: "How current are these numbers?",
      answer:
        "Each competitor row shows the date we last checked that vendor's public pricing page. Prices change, so check the vendor's site before you buy.",
    },
  ];
}
