import {
  IconEditFilled,
  IconListDetailsFilled,
  IconMapPinFilled,
  IconShieldCheckFilled,
  IconToolsKitchen2Filled,
  IconWorldFilled,
  type TablerIcon,
} from "@tabler/icons-react";

import { PLAN_CAPS, type Plan } from "@/lib/billing/plans";
import { PLAN_PRICES_ANNUAL_USD, PLAN_PRICES_USD } from "@/lib/constants/plan-pricing";

// Use-case landing pages at /solutions/<slug>. updatedOn is the sitemap lastmod: bump it whenever
// an entry's copy changes.
export type Solution = {
  slug: string;
  name: string;
  footerLabel: string;
  hubBlurb: string;
  // Absolute <title>: the brand once, at most 60 characters (titles.test.ts).
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  updatedOn: string;
  eyebrow: string;
  icon: TablerIcon;
  h1: string;
  subhead: string;
  heroPoints: string[];
  heroCta: string;
  benefitsTitle: string;
  benefits: { title: string; body: string; icon: TablerIcon }[];
  howToTitle: string;
  howTo: { title: string; body: string }[];
  plans: { plan: Plan; title: string; body: string }[];
  plansNote?: string;
  faqs: { question: string; answer: string }[];
  related: { href: string; label: string }[];
  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;
};

export const solutionsHubTitle = "Solutions: QR Codes and Links by Industry | iShortn";

// Prices and limits in the copy come from the billing constants so a pricing change can't leave a
// stale number behind (solutions.test.ts).
export const usd = (amount: number) => `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
const count = (limit: number | undefined) =>
  limit === undefined ? "unlimited" : limit.toLocaleString("en-US");

const free = PLAN_CAPS.free;
const freeQrCodes = count(free.qrCodeLimit);
const freeLinks = count(free.linksLimit);
const freeDays = count(free.analyticsRangeLimitDays);
const proMonthly = usd(PLAN_PRICES_USD.pro);

export const solutions = {
  restaurants: {
    slug: "restaurants",
    name: "Restaurants and bars",
    footerLabel: "Restaurants",
    hubBlurb: "Menu, table and review codes you can change after printing.",
    metaTitle: "QR Codes for Restaurants and Bars | iShortn",
    metaDescription:
      "Dynamic QR codes for menus, table cards and Google reviews. Change the link after printing, see scans for each location, and use your own domain. Free to start.",
    keywords: [
      "qr codes for restaurants",
      "restaurant qr code",
      "qr code for restaurant menu",
      "dynamic qr code for restaurant menu",
      "qr code for restaurant table",
      "qr code menu for bars",
    ],
    updatedOn: "2026-11-21",
    eyebrow: "Restaurants and bars",
    icon: IconToolsKitchen2Filled,
    h1: "QR codes for restaurants and bars",
    subhead:
      "Put a code on every table, menu and window. When the menu changes, you change the link and leave the print alone. You can also see how many people scanned at each location.",
    heroPoints: [
      `${freeQrCodes} dynamic QR codes free`,
      "No expiry date",
      "No ads when guests scan",
    ],
    heroCta: "Create a free menu code",
    benefitsTitle: "Built for menus that keep changing",
    benefits: [
      {
        title: "Update the menu without reprinting",
        body: "Each code points to a short link you control. When prices go up, the summer PDF replaces the spring one or you switch ordering apps, edit the destination in the dashboard. Every printed code opens the new page straight away.",
        icon: IconEditFilled,
      },
      {
        title: "A code for each table, location or window",
        body: `Give each location or placement its own code and compare them. Scans show the day, country, city and device. Free accounts see the last ${freeDays} days, and Pro keeps the full history.`,
        icon: IconMapPinFilled,
      },
      {
        title: "Your restaurant's name in the link",
        body: "On Pro, codes can run on your own domain, like menu.yourrestaurant.com/dinner, so guests can see where a code goes before they open it. iShortn issues the SSL certificate. Adding your logo and colours to a code works on every plan.",
        icon: IconWorldFilled,
      },
      {
        title: "Codes that don't switch off",
        body: "Some QR generators turn dynamic codes off when a trial or subscription ends, and every printed code stops working with them. iShortn's free dynamic codes have no expiry date and keep working without a paid plan.",
        icon: IconShieldCheckFilled,
      },
      {
        title: "Menu, booking and reviews from one code",
        body: `Point a code at a free bio page that holds your menu, booking and Google review links. The free page holds up to ${count(free.bioLinkBlocksPerPageLimit)} link blocks. Pro removes the iShortn badge and puts the page on your own domain.`,
        icon: IconListDetailsFilled,
      },
    ],
    howToTitle: "Set up a menu code in four steps",
    howTo: [
      {
        title: "Put the menu online",
        body: "Use a page on your website, a PDF or your ordering page. iShortn doesn't host menus. It sends each scan to wherever the menu lives.",
      },
      {
        title: "Create the code",
        body: "Paste the menu link, add your logo and colours, and download a high-resolution PNG.",
      },
      {
        title: "Print and test",
        body: "On a table card, make the code at least 3 to 4 cm wide. Scan a printed copy with two different phones before you print the full run.",
      },
      {
        title: "Change it when the menu changes",
        body: "Edit the destination in the dashboard and the codes on your tables follow.",
      },
    ],
    plans: [
      {
        plan: "free",
        title: "Free",
        body: `Up to ${freeQrCodes} codes and ${freeDays} days of scan data. Enough for one venue.`,
      },
      {
        plan: "pro",
        title: `Pro, ${proMonthly} a month, or ${usd(PLAN_PRICES_ANNUAL_USD.pro / 12)} a month billed yearly`,
        body: `Unlimited codes, your own domain and the full scan history. For groups with more than ${freeQrCodes} locations or placements.`,
      },
      {
        plan: "ultra",
        title: `Ultra, ${usd(PLAN_PRICES_USD.ultra)} a month`,
        body: "A shared team workspace, for groups where several managers look after the codes.",
      },
    ],
    plansNote: `Each QR code also uses one short link from the monthly allowance: ${freeLinks} on Free, ${count(PLAN_CAPS.pro.linksLimit)} on Pro and ${count(PLAN_CAPS.ultra.linksLimit)} on Ultra.`,
    faqs: [
      {
        question: "Is a restaurant menu QR code free with iShortn?",
        answer: `Yes. The free plan includes ${freeQrCodes} dynamic QR codes you can edit at any time, with scan counts for the last ${freeDays} days, no ads and no expiry date. Each code uses one of your ${freeLinks} free links a month. For more codes, Pro is ${proMonthly} a month.`,
      },
      {
        question: "How much does a QR code menu cost?",
        answer: `Nothing to start. The free plan's ${freeQrCodes} dynamic codes cost nothing and don't expire. If you need more codes or your own domain, Pro is ${proMonthly} a month, or ${usd(PLAN_PRICES_ANNUAL_USD.pro)} a year.`,
      },
      {
        question: "Can I change the menu after the QR codes are printed?",
        answer:
          "Yes. The printed code holds a short link, not the menu. Change where the link points in the dashboard and the same printed code opens the new menu.",
      },
      {
        question: "Does iShortn host my menu?",
        answer:
          "No. iShortn makes the code and sends each scan to your menu, wherever it lives. That can be your website, a PDF or an ordering page.",
      },
      {
        question: "How many QR codes do I need for several locations?",
        answer: `One per location, or one per placement if you want to compare tables, windows and takeaway bags. The free plan covers ${freeQrCodes} codes and Pro has no limit.`,
      },
      {
        question: "Can I see how many people scanned the menu?",
        answer: `Yes. iShortn counts every scan with the day, country, city and device type. Free shows the last ${freeDays} days. Pro and Ultra keep the full history.`,
      },
      {
        question: "Can the code use my restaurant's own domain?",
        answer:
          "Yes, on Pro and Ultra. Use a subdomain such as menu.yourrestaurant.com. You add the DNS records the dashboard shows you and iShortn handles the SSL certificate.",
      },
    ],
    related: [
      {
        href: "/blog/qr-code-for-restaurant-menu",
        label: "QR code for a restaurant menu, static vs dynamic",
      },
      { href: "/blog/qr-code-for-google-reviews", label: "Make a QR code for Google reviews" },
      { href: "/blog/qr-code-stopped-working", label: "Why QR codes stop working" },
      { href: "/docs/qr-codes", label: "QR codes in the docs" },
    ],
    ctaTitle: "Make your first menu code",
    ctaBody: `The free plan has ${freeQrCodes} dynamic QR codes with no ads and no expiry date. No credit card needed.`,
    ctaButton: "Create a free QR code",
  },
} satisfies Record<string, Solution>;

// Display order for the hub, the footer and /features.
export const solutionList: Solution[] = [solutions.restaurants];

export const getSolution = (slug: string): Solution | undefined =>
  solutionList.find((solution) => solution.slug === slug);

export const signUpHref = (slug: string, placement: "hero" | "cta") =>
  `/auth/sign-up?utm_source=site&utm_medium=solutions&utm_campaign=${slug}&utm_content=${placement}`;
