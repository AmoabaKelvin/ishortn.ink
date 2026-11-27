import { FREE_QR_CODE_LIMIT } from "@/lib/billing/entitlements";
import { PLAN_CAPS } from "@/lib/billing/plans";
import { PLAN_PRICES_USD } from "@/lib/constants/plan-pricing";

import { linkOwnershipFaq } from "./link-ownership";

const free = PLAN_CAPS.free;
const pro = PLAN_CAPS.pro;
const proPrice = `$${PLAN_PRICES_USD.pro} a month`;

export const landingPageCopy = {
  faq: [
    {
      question: "What is iShortn?",
      answer: `iShortn is a URL shortener with click analytics, custom domains, dynamic QR codes and link-in-bio pages. It's built for small businesses, creators, freelancers and small teams. There's a free plan, and paid plans start at ${proPrice}.`,
    },
    {
      question: "Is iShortn free to use?",
      answer: `Yes. The Free plan gives you ${free.linksLimit} links a month, ${free.eventsLimit?.toLocaleString("en-US")} tracked clicks and scans, ${free.analyticsRangeLimitDays} days of analytics, one link-in-bio page and ${FREE_QR_CODE_LIMIT} dynamic QR codes. No credit card is needed. Pro (${proPrice}) adds ${pro.linksLimit?.toLocaleString("en-US")} links a month, ${pro.domainLimit} custom domains and a full year of detailed analytics. Ultra ($${PLAN_PRICES_USD.ultra} a month) removes the limits and adds team workspaces.`,
    },
    {
      question: "Is iShortn a good free alternative to Bitly?",
      answer: `For most small businesses and creators, yes. Bitly Free allows 5 links a month with no click data and an ad page before each link opens. iShortn Free gives you ${free.linksLimit} links a month with location, device and referrer stats and no ad page. Custom domains cost ${proPrice} on iShortn Pro, against $29 a month billed annually on Bitly Growth. The full comparison is at ishortn.ink/compare/bitly.`,
    },
    {
      question: "Do iShortn QR codes expire?",
      answer: `No. QR codes made with an iShortn account are dynamic: they point to a short link, so you can change the destination after printing and see every scan. Free includes ${FREE_QR_CODE_LIMIT} that never expire and show no ads; Pro and Ultra add branded QR codes. The free QR code generator at ishortn.ink/qr-code-generator also makes static codes without an account.`,
    },
    {
      question: "Can I use my own custom domain?",
      answer: `Yes, on Pro (up to ${pro.domainLimit} domains) and Ultra (unlimited). Your short links, QR codes and bio pages can all use the same domain, such as links.yourbrand.com/sale. Free links use isht.app.`,
    },
    {
      question: "Can I use iShortn instead of Linktree?",
      answer: `Yes. A link-in-bio page holds link buttons, social icons, headings and text, and every button is a tracked short link. Free includes one page with up to ${free.bioLinkBlocksPerPageLimit} link blocks. Pro (${proPrice}) gives you ${pro.bioPageLimit} pages on your own domain without iShortn branding, which Linktree doesn't offer on any plan. Ultra adds unlimited pages and scheduled blocks.`,
    },
    {
      question: "Can I track the performance of my links?",
      answer: `Yes. Each click or scan records the country, city, device, browser and referrer. Bots and link scanners are filtered out. Free keeps ${free.analyticsRangeLimitDays} days of history, and Pro and Ultra keep it without a time limit. Pro and Ultra can also export the clicks for any date range as a CSV file for your own reports.`,
    },
    {
      question: "Are the shortened URLs permanent?",
      answer:
        "Yes. Links stay active as long as your account exists, and you can change a link's destination or alias on every plan. If you reach your monthly limit, existing links keep redirecting.",
    },
    linkOwnershipFaq,
    {
      question: "Is there an API available?",
      answer:
        "Yes, a REST API on Pro and Ultra. You can create, update and delete links and read their analytics. The API docs are at ishortn.ink/docs/api.",
    },
    {
      question: "How do you keep short links safe?",
      answer:
        "New links are checked against phishing and malware blocklists, and links found to be harmful are blocked. You can also password-protect a link, set an expiry date, and send visitors to different destinations by country or device.",
    },
  ],
};

// Posts the homepage links to, in display order. Each appears only once it is live, so a scheduled
// post never becomes a 404 link.
export const homeGuideSlugs = [
  "what-is-a-url-shortener",
  "url-shortener-api-guide",
  "how-to-track-link-clicks",
  "how-to-track-qr-code-scans",
  "free-qr-code-generator-guide",
  "bitly-alternatives",
  "best-free-url-shorteners",
  "url-shortener-vs-link-management-platform",
] as const;
