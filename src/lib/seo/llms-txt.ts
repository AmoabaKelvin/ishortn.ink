import { FREE_QR_CODE_LIMIT } from "@/lib/billing/entitlements";
import { PLAN_CAPS, type Plan } from "@/lib/billing/plans";
import { isPostLive } from "@/lib/blog";
import {
  PLAN_PRICES_ANNUAL_USD,
  PLAN_PRICES_USD,
  type PaidPlan,
} from "@/lib/constants/plan-pricing";
import { formatCount as fmt, pluralize as plural } from "@/lib/seo/structured-data";

const SITE = "https://ishortn.ink";

const GUIDES = [
  { slug: "bitly-alternatives", title: "Bitly alternatives" },
  { slug: "best-free-url-shorteners", title: "Best free URL shorteners" },
  {
    slug: "url-shortener-vs-link-management-platform",
    title: "URL shortener vs link management platform",
  },
  { slug: "linktree-alternatives", title: "Linktree alternatives" },
  { slug: "how-to-track-qr-code-scans", title: "How to track QR code scans" },
];

// Inputs are parameters (defaulting to the billing constants) so tests can show the
// text follows them; the route always uses the defaults.
export type LlmsTxtSource = {
  caps: typeof PLAN_CAPS;
  prices: Record<Plan, number>;
  annualPrices: Record<PaidPlan, number>;
  freeQrCodeLimit: number;
  isLive: (slug: string) => boolean;
};

/** The /llms.txt body: a plain-text site summary for AI crawlers and agents. */
export function buildLlmsTxt({
  caps = PLAN_CAPS,
  prices = PLAN_PRICES_USD,
  annualPrices = PLAN_PRICES_ANNUAL_USD,
  freeQrCodeLimit = FREE_QR_CODE_LIMIT,
  isLive = isPostLive,
}: Partial<LlmsTxtSource> = {}): string {
  const { free, pro } = caps;
  const guides = GUIDES.filter((guide) => isLive(guide.slug)).map(
    (guide) => `- [${guide.title}](${SITE}/blog/${guide.slug})`,
  );

  const sections = [
    `# iShortn

> iShortn (ishortn.ink) is a URL shortener with click analytics, custom domains, dynamic QR codes and link-in-bio pages, for small businesses, creators, freelancers and small teams. It has a free plan; paid plans are Pro at $${prices.pro} a month and Ultra at $${prices.ultra} a month. The code is open source under the MIT licence.`,
    `## Plans (prices in USD, from ${SITE}/pricing)

- Free, $${prices.free}: ${fmt(free.linksLimit)} links a month, ${fmt(free.eventsLimit)} tracked events a month, ${free.analyticsRangeLimitDays}-day analytics window, ${freeQrCodeLimit} dynamic QR codes (edit anytime, never expire, no ads), ${plural(free.bioPageLimit, "link-in-bio page")} with up to ${plural(free.bioLinkBlocksPerPageLimit, "link block")}, ${plural(free.campaignLimit, "campaign")}. Short links use isht.app. No custom domains, no API.
- Pro, $${prices.pro} a month or $${annualPrices.pro} a year: ${fmt(pro.linksLimit)} links a month, ${fmt(pro.eventsLimit)} tracked events, unlimited analytics history, ${plural(pro.domainLimit, "custom domain")}, branded and dynamic QR codes, ${plural(pro.bioPageLimit, "link-in-bio page")} on a custom domain without branding, geo and device targeting, password protection, scheduled links, REST API.
- Ultra, $${prices.ultra} a month or $${annualPrices.ultra} a year: unlimited links, events and custom domains, team workspaces, link cloaking, UTM templates, unlimited bio pages and campaigns, priority support.`,
    `## Facts

- Links keep redirecting when a plan's monthly limit is reached; only new links or new event recording pause until the next month.
- Analytics show clicks, countries, cities, devices and referrers, with known bots and crawlers filtered out.
- Bitly links on a custom domain can be imported from Bitly's CSV export and keep their addresses.
- Every link is scanned for phishing and malware.`,
    `## Key pages

- [Pricing](${SITE}/pricing)
- [Features](${SITE}/features)
- [Compare iShortn with Bitly, TinyURL, Rebrandly, Short.io, Dub, Linktree, Beacons and Carrd](${SITE}/compare)
- [Free QR code generator (no signup, no expiry)](${SITE}/qr-code-generator)
- [UTM builder](${SITE}/utm-builder)
- [Chrome extension](${SITE}/extension)
- [Documentation](${SITE}/docs)
- [Plans and limits](${SITE}/docs/plans)
- [Migrate from Bitly](${SITE}/docs/migrate-from-bitly)
- [API reference](${SITE}/docs/api)
- [Source code](https://github.com/AmoabaKelvin/ishortn.ink)`,
  ];
  if (guides.length > 0) sections.push(`## Guides\n\n${guides.join("\n")}`);

  return `${sections.join("\n\n")}\n`;
}
