import {
  IconBriefcaseFilled,
  IconEditFilled,
  IconFileUploadFilled,
  IconFoldersFilled,
  IconListDetailsFilled,
  IconMapPinFilled,
  IconReportAnalyticsFilled,
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
const proDomains = count(PLAN_CAPS.pro.domainLimit);

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
  agencies: {
    slug: "agencies",
    name: "Agencies and print shops",
    footerLabel: "Agencies",
    hubBlurb: "Client codes on client domains, with a workspace per client.",
    metaTitle: "QR Codes and Short Links for Agencies | iShortn",
    metaDescription:
      "Make QR codes and short links for clients that you can change after printing. Keep each client in its own workspace and on its own domain, with scan numbers to report.",
    keywords: [
      "qr codes for agencies",
      "url shortener for agencies",
      "link management for agencies",
      "dynamic qr codes for clients",
      "qr codes for print shops",
      "white label qr code generator",
    ],
    updatedOn: "2026-11-21",
    eyebrow: "Agencies and print shops",
    icon: IconBriefcaseFilled,
    h1: "QR codes and short links for agencies and print shops",
    subhead:
      "Make codes for clients that you can still change after the job is printed. Each client gets a separate workspace and their own domain, and you can send them the scan numbers.",
    heroPoints: ["Editable after printing", "Runs on the client's domain", "Teammates join free"],
    heroCta: "Start free",
    benefitsTitle: "Made for client work",
    benefits: [
      {
        title: "Change the code after the job is printed",
        body: "A static code fixes the URL into the print. An iShortn code holds a short link instead. When a client changes a handle, a menu or a landing page, you edit the link and the stickers, signs and postcards keep working.",
        icon: IconEditFilled,
      },
      {
        title: "A workspace for each client",
        body: "On Ultra you can create team workspaces and keep each client's links, QR codes and domains apart. Invite your staff, or the client, as admins or members. Members don't need a paid plan, there's no limit on members, and a team workspace has no cap on QR codes.",
        icon: IconFoldersFilled,
      },
      {
        title: "Links on the client's own domain",
        body: `Links and codes can run on the client's domain, like go.clientbrand.com/spring. Pro includes ${proDomains} custom domains and Ultra has no limit. iShortn issues and renews the SSL certificates.`,
        icon: IconWorldFilled,
      },
      {
        title: "Scan numbers for every job",
        body: "Each scan records the day, country, city, device and referrer, and unique visitors are counted separately. Pro and Ultra keep the full history, and campaign analytics export to CSV for client reports.",
        icon: IconReportAnalyticsFilled,
      },
      {
        title: "Bring existing links with you",
        body: "On Pro and Ultra you can import up to 1,000 links per CSV file, and a Bitly export works as it is. Once the client's short domain points to iShortn, their existing Bitly links can keep working.",
        icon: IconFileUploadFilled,
      },
    ],
    howToTitle: "How a client job runs",
    howTo: [
      {
        title: "Set up the client",
        body: `On Ultra, create a team workspace for the client. On Pro, use folders in your own workspace, up to ${count(PLAN_CAPS.pro.folderLimit)} of them.`,
      },
      {
        title: "Connect the client's domain",
        body: "Add a subdomain such as go.clientbrand.com, then create the CNAME and TXT records the dashboard shows.",
      },
      {
        title: "Make the codes",
        body: "Style each code with the client's logo and colours and download a high-resolution PNG for the print file.",
      },
      {
        title: "Repoint and report",
        body: "Change destinations when the campaign changes, and send the client the scan numbers.",
      },
    ],
    plans: [
      {
        plan: "pro",
        title: `Pro, ${proMonthly} a month`,
        body: `For freelancers and small studios. ${proDomains} custom domains, unlimited QR codes, ${count(PLAN_CAPS.pro.linksLimit)} links a month, CSV import and the API.`,
      },
      {
        plan: "ultra",
        title: `Ultra, ${usd(PLAN_PRICES_USD.ultra)} a month`,
        body: "For agencies with several clients or staff. Unlimited custom domains and links, plus team workspaces that teammates join free.",
      },
    ],
    faqs: [
      {
        question: "Can I manage QR codes for several clients in one account?",
        answer: `Yes. On Ultra, create a team workspace for each client and switch between them in the dashboard. On Pro, keep clients apart with folders and up to ${proDomains} custom domains.`,
      },
      {
        question: "Can my clients see their own scan numbers?",
        answer:
          "Yes. Invite the client to their team workspace and they see its links and analytics. Members can also create and edit links, so if you'd rather keep the client read-only, export the campaign analytics to CSV and send that instead.",
      },
      {
        question: "Is iShortn white label?",
        answer:
          "Partly. Links and QR codes can run on the client's own domain, so the link their customers see has no iShortn name in it. The dashboard carries the iShortn name, and there's no reseller portal or custom-branded login.",
      },
      {
        question: "What file format do the QR codes download in?",
        answer: "A high-resolution PNG that works for print. There's no SVG or PDF export yet.",
      },
      {
        question: "Do the codes expire if a trial or plan ends?",
        answer:
          "iShortn has no trial that switches codes off. Dynamic codes made on the free plan have no expiry date and keep working without a paid plan.",
      },
      {
        question: "What happens to the codes when a client contract ends?",
        answer:
          "You can hand the client's team workspace to them by transferring ownership. The new owner must already be a team member with an Ultra plan. You can also move links into another workspace you both belong to, up to 100 at a time, and QR codes move with their links. Agree who owns the codes before you print.",
      },
      {
        question: "Can I move a client's links from Bitly?",
        answer:
          "Yes. Upload their Bitly export as a CSV on Pro or Ultra. If the client's branded short domain then points to iShortn, their existing Bitly links keep working. The migration guide walks through it.",
      },
    ],
    related: [
      { href: "/docs/teams", label: "Teams and workspaces" },
      { href: "/docs/custom-domains", label: "Custom domains" },
      { href: "/docs/migrate-from-bitly", label: "Move your links from Bitly" },
      {
        href: "/blog/url-shortener-for-marketers",
        label: "What marketers need from a link shortener",
      },
      { href: "/blog/how-to-track-qr-code-scans", label: "How to track QR code scans" },
    ],
    ctaTitle: "Set up your first client",
    ctaBody:
      "Start on the free plan and move to Pro or Ultra when you add client domains. No credit card needed.",
    ctaButton: "Start free",
  },
} satisfies Record<string, Solution>;

// Display order for the hub, the footer and /features.
export const solutionList: Solution[] = [solutions.restaurants, solutions.agencies];

export const getSolution = (slug: string): Solution | undefined =>
  solutionList.find((solution) => solution.slug === slug);

export const signUpHref = (slug: string, placement: "hero" | "cta") =>
  `/auth/sign-up?utm_source=site&utm_medium=solutions&utm_campaign=${slug}&utm_content=${placement}`;
