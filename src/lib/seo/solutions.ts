import {
  IconBasketFilled,
  IconBoxMultipleFilled,
  IconBrandInstagramFilled,
  IconBriefcaseFilled,
  IconCalendarEventFilled,
  IconChartPieFilled,
  IconClockFilled,
  IconDeviceMobileFilled,
  IconEditFilled,
  IconFileUploadFilled,
  IconFoldersFilled,
  IconGiftFilled,
  IconHeartFilled,
  IconHomeFilled,
  IconHourglassFilled,
  IconIdFilled,
  IconKeyFilled,
  IconLinkFilled,
  IconListDetailsFilled,
  IconMapPinFilled,
  IconReportAnalyticsFilled,
  IconShieldCheckFilled,
  IconStarFilled,
  IconToolsKitchen2Filled,
  IconUserFilled,
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
    updatedOn: "2026-11-22",
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
      { href: "/whatsapp-link-generator", label: "Free WhatsApp link and QR code generator" },
      {
        href: "/blog/whatsapp-link-with-message",
        label: "How to create a WhatsApp link with a pre-filled message",
      },
      { href: "/blog/qr-code-for-google-reviews", label: "Make a QR code for Google reviews" },
      { href: "/blog/qr-code-stopped-working", label: "Why QR codes stop working" },
      { href: "/docs/qr-codes", label: "QR codes in the docs" },
    ],
    ctaTitle: "Make your first menu code",
    ctaBody: `The free plan has ${freeQrCodes} dynamic QR codes with no ads and no expiry date. No credit card needed.`,
    ctaButton: "Create a free QR code",
  },
  "small-business": {
    slug: "small-business",
    name: "Small businesses and shops",
    footerLabel: "Small business",
    hubBlurb: "Packaging, receipt, counter and review codes you can change after printing.",
    metaTitle: "QR Codes for Small Businesses and Shops | iShortn",
    metaDescription:
      "Free dynamic QR codes for packaging, receipts, counter signs and Google reviews. Change the link after printing and see which spot gets scanned most.",
    keywords: [
      "qr code for small business",
      "free qr code for small business",
      "qr code for product packaging",
      "qr code for business reviews",
      "qr code sign for small business",
      "qr code packaging stickers",
      "qr code for business instagram",
    ],
    updatedOn: "2026-11-22",
    eyebrow: "Small businesses and shops",
    icon: IconBasketFilled,
    h1: "QR codes for small businesses and shops",
    subhead:
      "Put one code on your bags, labels and receipts and another on the counter for Google reviews. Change where they point when your offer changes, and see which ones people scan.",
    heroPoints: [
      `${freeQrCodes} dynamic QR codes free`,
      "Change the link after printing",
      "No ads when customers scan",
    ],
    heroCta: "Create a free shop code",
    benefitsTitle: "Print it once, change it when you need to",
    benefits: [
      {
        title: "Packaging that can point somewhere new",
        body: "Put a code on labels, swing tags, boxes or a thank-you card. Point it at care instructions now and your reorder page later. Packaging you printed last year opens whatever the code points at today.",
        icon: IconBoxMultipleFilled,
      },
      {
        title: "Google reviews from the counter",
        body: "Point a counter sign or receipt code at your Google review link. Customers can scan while the card machine works, and you see how many scans each spot gets. Google doesn't allow discounts or gifts in exchange for reviews, so keep the sign to a plain ask.",
        icon: IconStarFilled,
      },
      {
        title: "A code for each spot",
        body: `Give the counter, the window, the receipts and the market stall banner their own codes and compare them. Scans show the day, country, city and device. Free accounts see the last ${freeDays} days, and Pro keeps the full history.`,
        icon: IconMapPinFilled,
      },
      {
        title: "Instagram, shop and reviews on one page",
        body: `Point one code at a free bio page with your Instagram, online shop and review links, and put the same page in your Instagram bio. The free page holds up to ${count(free.bioLinkBlocksPerPageLimit)} link blocks, plus text and social icons that don't count toward the limit.`,
        icon: IconBrandInstagramFilled,
      },
      {
        title: "Codes that don't switch off",
        body: "Some QR generators turn dynamic codes off when a trial or subscription ends, and every printed label stops working with them. iShortn's free dynamic codes have no expiry date and keep working without a paid plan.",
        icon: IconShieldCheckFilled,
      },
    ],
    howToTitle: "Set up a shop code in four steps",
    howTo: [
      {
        title: "Pick the page",
        body: "Use your Google review link, your online shop, your Instagram profile or a product page. iShortn doesn't take payments. It sends each scan to the page you choose.",
      },
      {
        title: "Create the code",
        body: "Paste the link, add your logo and colours, and download a high-resolution PNG, or an SVG for stickers, vinyl and engraving.",
      },
      {
        title: "Print and test",
        body: "On a receipt, label or card held in the hand, make the code at least 2 cm wide. A counter or window sign read from a metre or two away needs 10 cm or more. Scan a printed copy with two phones before the full run.",
      },
      {
        title: "Change it when your offer changes",
        body: "Edit the destination in the dashboard. Every bag, sticker and sign you've already printed opens the new page.",
      },
    ],
    plans: [
      {
        plan: "free",
        title: "Free",
        body: `Up to ${freeQrCodes} codes, ${freeDays} days of scan data and a bio page. Enough for a review code, a packaging code and a counter sign.`,
      },
      {
        plan: "pro",
        title: `Pro, ${proMonthly} a month, or ${usd(PLAN_PRICES_ANNUAL_USD.pro / 12)} a month billed yearly`,
        body: `Unlimited codes, ${proDomains} custom domains such as go.yourshop.com, the full scan history and scheduled links for seasonal offers. For shops with more than ${freeQrCodes} placements.`,
      },
      {
        plan: "ultra",
        title: `Ultra, ${usd(PLAN_PRICES_USD.ultra)} a month`,
        body: "A shared team workspace, for shops where staff or a partner look after the codes too. Members join free.",
      },
    ],
    plansNote: `Each QR code also uses one short link from the monthly allowance: ${freeLinks} on Free, ${count(PLAN_CAPS.pro.linksLimit)} on Pro and ${count(PLAN_CAPS.ultra.linksLimit)} on Ultra.`,
    faqs: [
      {
        question: "Is a QR code for a small business free with iShortn?",
        answer: `Yes. The free plan includes ${freeQrCodes} dynamic QR codes with no ads and no expiry date, and you can change where each one points at any time. Each code uses one of your ${freeLinks} free links a month. For more codes, Pro is ${proMonthly} a month.`,
      },
      {
        question: "What should a QR code on product packaging link to?",
        answer:
          "Something the buyer needs after the sale: care or setup instructions, ingredients, a how-to video, your reorder page or your Instagram. The code is dynamic, so you can change the page later without reprinting the labels.",
      },
      {
        question: "How do I make a QR code for Google reviews?",
        answer:
          "Copy the review link from your Google Business Profile, paste it into a new QR code in iShortn and download it. Print it on a counter sign, a receipt or a thank-you card, and ask customers in person. Google doesn't allow rewards for reviews.",
      },
      {
        question: "How big should the code be on a receipt or label?",
        answer:
          "At least 2 cm wide for anything held in the hand, such as a receipt, swing tag or label. A code scans from about ten times its own width, so a counter sign read from a metre away needs a code about 10 cm wide. Print one copy and scan it before the full run.",
      },
      {
        question: "Can customers pay through an iShortn code?",
        answer:
          "No. iShortn codes open a web page and don't take payments. For card or mobile payments, use the code from your payment provider. Use iShortn codes for reviews, your online shop, your socials and product information.",
      },
      {
        question: "Will my codes stop working if I don't pay?",
        answer:
          "No. Dynamic codes made on the free plan have no expiry date and keep working without a paid plan.",
      },
      {
        question: "Can the code use my shop's own domain?",
        answer:
          "Yes, on Pro and Ultra. Use a subdomain such as go.yourshop.com, add the DNS records the dashboard shows, and iShortn handles the SSL certificate.",
      },
    ],
    related: [
      {
        href: "/blog/qr-code-on-product-packaging",
        label: "QR codes on product packaging and labels",
      },
      { href: "/blog/qr-code-for-google-reviews", label: "Make a QR code for Google reviews" },
      { href: "/blog/qr-code-for-flyers", label: "Put a QR code on a flyer" },
      {
        href: "/blog/free-qr-code-generator-guide",
        label: "QR codes for your business, a free guide",
      },
      { href: "/qr-code-generator", label: "Free QR code generator" },
      { href: "/whatsapp-link-generator", label: "Free WhatsApp link and QR code generator" },
      {
        href: "/blog/whatsapp-link-with-message",
        label: "How to create a WhatsApp link with a pre-filled message",
      },
      { href: "/docs/qr-codes", label: "QR codes in the docs" },
    ],
    ctaTitle: "Make your first shop code",
    ctaBody: `The free plan has ${freeQrCodes} dynamic QR codes with no ads and no expiry date. No credit card needed.`,
    ctaButton: "Create a free QR code",
  },
  creators: {
    slug: "creators",
    name: "Creators and freelancers",
    footerLabel: "Creators",
    hubBlurb: "A link-in-bio page with clicks on every link, and your own domain on Pro.",
    metaTitle: "Link in Bio for Creators and Freelancers | iShortn",
    metaDescription: `A link-in-bio page, short links and QR codes in one account, with clicks counted on every link. Free to start, and ${proMonthly} a month for your own domain.`,
    keywords: [
      "link in bio for creators",
      "link in bio tool for creators",
      "best link in bio for creators",
      "linktree alternatives for creators",
      "linktree alternative with custom domain",
      "free link in bio",
    ],
    updatedOn: "2026-11-21",
    eyebrow: "Creators and freelancers",
    icon: IconUserFilled,
    h1: "Link in bio for creators",
    subhead:
      "One page for your Instagram, TikTok or YouTube bio, with a tracked short link behind every button. See which links people tap, and move the page to your own domain when you're ready.",
    heroPoints: [
      "Free bio page, no card",
      "Clicks counted on every link",
      "Your own domain on Pro",
    ],
    heroCta: "Create a free bio page",
    benefitsTitle: "A bio page that tells you what people tap",
    benefits: [
      {
        title: "See which links people tap",
        body: `Each link block on the page gets its own short link, so every button has its own click count, with the country, city, device and referrer. Free accounts see the last ${freeDays} days, and Pro keeps the full history.`,
        icon: IconChartPieFilled,
      },
      {
        title: "Your page on your own domain",
        body: `On Pro, the page can open at the root of a domain you own, like yourname.com or links.yourname.com, while your short links work underneath it, like yourname.com/podcast. Pro includes ${proDomains} custom domains, and iShortn issues the SSL certificate.`,
        icon: IconWorldFilled,
      },
      {
        title: "Short links for everything else",
        body: `The same account shortens the links you put in a video description, a newsletter or a client proposal, and counts their clicks too. Free accounts get ${freeLinks} new short links a month.`,
        icon: IconLinkFilled,
      },
      {
        title: "Send phones to the right app",
        body: `On Pro, one short link can send iPhone visitors to Apple Music and Android visitors to Spotify, or send each country to its own store. Each link takes up to ${count(PLAN_CAPS.pro.geoRulesLimit)} targeting rules on Pro.`,
        icon: IconDeviceMobileFilled,
      },
      {
        title: "A QR code for the page",
        body: "Download a QR code for your bio page from the editor and put it on merch, a business card or the last slide of a talk. The code opens the page, so it always shows your current links.",
        icon: IconIdFilled,
      },
    ],
    howToTitle: "Set up your bio page in four steps",
    howTo: [
      {
        title: "Pick a handle",
        body: "Your page lives at ishortn.ink/p/yourname. Handles use lowercase letters, numbers, hyphens and underscores.",
      },
      {
        title: "Add your links",
        body: `Add link blocks for what matters most, plus headings, text, social icons and an email button. A free page holds ${count(free.bioLinkBlocksPerPageLimit)} link blocks, and the other blocks don't count toward that limit.`,
      },
      {
        title: "Pick a theme and publish",
        body: "Choose a theme, add your photo and publish. Pro can also change the accent colour, background, font and button style.",
      },
      {
        title: "Put it in your bio",
        body: "Paste the page link into your Instagram, TikTok or YouTube bio. After a week, check which links people tap and move the busiest one to the top.",
      },
    ],
    plans: [
      {
        plan: "free",
        title: "Free",
        body: `One bio page with up to ${count(free.bioLinkBlocksPerPageLimit)} link blocks, ${freeLinks} short links a month and ${freeQrCodes} dynamic QR codes. The page shows a small "Made with iShortn" badge.`,
      },
      {
        plan: "pro",
        title: `Pro, ${proMonthly} a month, or ${usd(PLAN_PRICES_ANNUAL_USD.pro / 12)} a month billed yearly`,
        body: `${count(PLAN_CAPS.pro.bioPageLimit)} bio pages with no link block limit, your own domain, custom colours and fonts, no badge and the full click history. Link blocks on Pro count toward its ${count(PLAN_CAPS.pro.linksLimit)} links a month.`,
      },
      {
        plan: "ultra",
        title: `Ultra, ${usd(PLAN_PRICES_USD.ultra)} a month`,
        body: "Unlimited bio pages and links, blocks you can schedule to appear and disappear, and a team workspace for a manager or assistant. Members join free.",
      },
    ],
    plansNote: `Free records ${count(free.eventsLimit)} clicks and page views a month across your account, and Pro records ${count(PLAN_CAPS.pro.eventsLimit)}. Past that, your page and links keep working, but new visits aren't counted until the next month.`,
    faqs: [
      {
        question: "Is the iShortn bio page free?",
        answer: `Yes. The free plan includes one bio page with up to ${count(free.bioLinkBlocksPerPageLimit)} link blocks, plus headings, text, social icons and an email button that don't count toward the limit. The page has no expiry date. Pro is ${proMonthly} a month and removes the block limit and the badge.`,
      },
      {
        question: "Is iShortn a Linktree alternative?",
        answer: `For some creators. Linktree's free plan allows unlimited links, and a free iShortn page holds ${count(free.bioLinkBlocksPerPageLimit)} link blocks, so if you need many links for free, Linktree fits better. iShortn fits if you want click counts on every link, short links and QR codes in the same account, or the page on your own domain. Linktree's help centre says it doesn't support custom domains, and iShortn Pro does.`,
      },
      {
        question: "Can I put my link in bio on my own domain?",
        answer:
          "Yes, on Pro and Ultra. Add a domain you own, such as yourname.com or links.yourname.com, create the DNS records the dashboard shows, then choose the domain in the page's settings. Your short links keep working at paths under the same domain.",
      },
      {
        question: "Can I see which links people click?",
        answer: `Yes. Each bio page counts views, and each link block counts clicks with the country, device and referrer. Free shows the last ${freeDays} days. Pro and Ultra keep the full history.`,
      },
      {
        question: "Do bio page links count toward my monthly links?",
        answer: `Not on Free. Link blocks on a free bio page don't use any of your ${freeLinks} free links a month. On Pro, each link block counts toward the ${count(PLAN_CAPS.pro.linksLimit)} links a month.`,
      },
      {
        question: "Can I sell products or take tips on the page?",
        answer:
          "No. iShortn has no store, checkout or tip jar. Link to the shop or tip page you already use, such as Shopify, Etsy, Gumroad or Ko-fi, and iShortn counts the clicks. If selling from the page itself matters most, a creator commerce tool fits better.",
      },
      {
        question: "I'm a freelancer. Does this fit me too?",
        answer:
          "Yes. Use the page as a short contact page with your portfolio, booking link and an email button. On Pro, put it at links.yourname.com and use that address in your email signature and proposals.",
      },
    ],
    related: [
      {
        href: "/blog/linktree-custom-domain",
        label: "Linktree and custom domains, and what to use instead",
      },
      { href: "/compare/linktree", label: "iShortn vs Linktree" },
      {
        href: "/blog/short-links-social-media-marketing",
        label: "Short links in social media marketing",
      },
      {
        href: "/blog/custom-short-links-for-your-brand",
        label: "Custom short links for your brand",
      },
      { href: "/docs/bio-pages", label: "Bio pages in the docs" },
    ],
    ctaTitle: "Make your bio page",
    ctaBody: `The free plan has one bio page, ${freeLinks} short links a month and ${freeQrCodes} dynamic QR codes. No credit card needed.`,
    ctaButton: "Create a free bio page",
  },
  "churches-and-nonprofits": {
    slug: "churches-and-nonprofits",
    name: "Churches and nonprofits",
    footerLabel: "Churches and nonprofits",
    hubBlurb: "Bulletin, giving and sign-up codes on the free plan.",
    metaTitle: "QR Codes for Churches and Nonprofits | iShortn",
    metaDescription:
      "Free dynamic QR codes for bulletins, giving pages, sign-up forms and event posters. Change the link any week without reprinting, and see how many people scanned.",
    keywords: [
      "qr code for church",
      "qr code for church bulletin",
      "qr code for church giving",
      "qr code for nonprofits",
      "free qr code generator for nonprofits",
      "qr code for donations",
    ],
    updatedOn: "2026-11-21",
    eyebrow: "Churches and nonprofits",
    icon: IconHeartFilled,
    h1: "QR codes for churches and nonprofits",
    subhead:
      "Put one code in the bulletin, on the welcome card and on event posters. Change where it points each week and see how many people scanned. The free plan has no expiry date.",
    heroPoints: ["Free plan, no card", "New link any week", "No ads when people scan"],
    heroCta: "Create a free code",
    benefitsTitle: "Print once, update every week",
    benefits: [
      {
        title: "One printed code, a new link every week",
        body: "Point the bulletin code at this week's sign-up form, then at next week's. Codes on seat backs, the welcome desk and lobby signs work the same way, so you print them once and keep them.",
        icon: IconEditFilled,
      },
      {
        title: "Free for small teams",
        body: `The free plan has ${freeQrCodes} dynamic QR codes, ${freeLinks} short links a month and a bio page, with no ads and no expiry date. That covers a weekly bulletin code, a giving code and a few event posters.`,
        icon: IconGiftFilled,
      },
      {
        title: "Giving, visits and prayer requests behind one code",
        body: `Point a code at a bio page with your giving page, plan-a-visit form and prayer request form. The free page holds up to ${count(free.bioLinkBlocksPerPageLimit)} link blocks. Pro has no block limit, removes the iShortn badge and puts the page on your own domain.`,
        icon: IconListDetailsFilled,
      },
      {
        title: "Sign-ups that close on time",
        body: "A link can stop working after a date or a number of clicks, so a full event stops taking sign-ups. Expiry works on every plan, including Free.",
        icon: IconHourglassFilled,
      },
      {
        title: "See what people respond to",
        body: `Each scan records the day, city and device. Give the bulletin and the poster their own codes and compare them. Free shows the last ${freeDays} days, and Pro keeps the full history.`,
        icon: IconChartPieFilled,
      },
    ],
    howToTitle: "Put a QR code in your bulletin",
    howTo: [
      {
        title: "Pick the page",
        body: "Decide where the code goes this week: the giving page, a sign-up form, a visitor card or an event page.",
      },
      {
        title: "Make the code",
        body: "Paste the link, add your logo and download a high-resolution PNG.",
      },
      {
        title: "Print and test",
        body: "Put it in the bulletin or on the poster with a line saying what it opens. Scan a printed copy before you print the rest.",
      },
      {
        title: "Change it next week",
        body: "Edit the destination in the dashboard, and the printed code opens the new page.",
      },
    ],
    plans: [
      {
        plan: "free",
        title: "Free",
        body: `Up to ${freeQrCodes} codes, ${freeLinks} links a month and ${count(free.bioPageLimit)} bio page. Fits most weekly bulletins.`,
      },
      {
        plan: "pro",
        title: `Pro, ${proMonthly} a month, or ${usd(PLAN_PRICES_ANNUAL_USD.pro)} a year`,
        body: "Unlimited codes, your own domain such as give.yourchurch.org, the full scan history, scheduled links and password protection.",
      },
      {
        plan: "ultra",
        title: `Ultra, ${usd(PLAN_PRICES_USD.ultra)} a month`,
        body: "A shared workspace where staff and volunteers manage links together. Volunteers join free.",
      },
    ],
    faqs: [
      {
        question: "Is iShortn free for churches and nonprofits?",
        answer: `The free plan is open to everyone and doesn't expire. It includes ${freeQrCodes} dynamic QR codes, ${freeLinks} short links a month and a bio page. There's no separate nonprofit plan. If you need more, Pro is ${proMonthly} a month.`,
      },
      {
        question: "How do I make a QR code for church giving?",
        answer:
          "Copy the link to your online giving page, paste it into a new QR code in iShortn and download the PNG. The code opens your giving page, whichever provider runs it. iShortn doesn't handle money. Payments happen on your giving provider's page.",
      },
      {
        question: "Can we change the bulletin QR code every week?",
        answer:
          "Yes. The printed code holds a short link. Change where it points in the dashboard each week and the same code opens the new page.",
      },
      {
        question: "Will our QR codes stop working if we don't pay?",
        answer:
          "No. Dynamic codes made on the free plan have no expiry date and keep working without a paid plan.",
      },
      {
        question: "Can several staff members or volunteers manage the links?",
        answer:
          "Yes, on Ultra. The owner creates a team workspace and invites people as admins or members. Members don't need a paid plan.",
      },
      {
        question: "How do people know a giving code is really ours?",
        answer:
          "Print the short link next to the code so people can check where it goes. On Pro, that link can use your own domain, like give.yourchurch.org. Check printed codes now and then for stickers placed over them.",
      },
      {
        question: "Can we use our own domain, like give.ourchurch.org?",
        answer:
          "Yes, on Pro and Ultra. Add the subdomain in the dashboard and create the DNS records it shows. iShortn handles the SSL certificate.",
      },
    ],
    related: [
      { href: "/blog/qr-code-for-flyers", label: "Put a QR code on a flyer" },
      { href: "/blog/how-to-track-qr-code-scans", label: "How to track QR code scans" },
      { href: "/blog/qr-code-stopped-working", label: "Why QR codes stop working" },
      { href: "/docs/bio-pages", label: "Bio pages in the docs" },
    ],
    ctaTitle: "Make your first bulletin code",
    ctaBody: `The free plan has ${freeQrCodes} dynamic QR codes and a bio page, with no ads and no expiry date. No credit card needed.`,
    ctaButton: "Create a free code",
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
    updatedOn: "2026-11-24",
    eyebrow: "Agencies and print shops",
    icon: IconBriefcaseFilled,
    h1: "QR codes and short links for agencies and print shops",
    subhead:
      "Make codes for clients that you can still change after the job is printed. Each client gets a separate workspace and their own domain, and they can follow the scan numbers on a read-only stats page without an account.",
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
        body: "Each scan records the day, country, city, device and referrer, and unique visitors are counted separately. To show a client the results, turn on a read-only stats page for the link and send them the address. They don't need an account, and the page never shows the destination or your workspace. Pro and Ultra keep the full history, and campaign analytics export to CSV.",
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
        body: "Style each code with the client's logo and colours and download a high-resolution PNG for the print file, or an SVG for large signs and engraving.",
      },
      {
        title: "Repoint and report",
        body: "Change destinations when the campaign changes. For reporting, send the client the link's read-only stats page, or export the numbers to CSV.",
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
          "Yes. Invite the client to their team workspace and they see its links and analytics. Members can also create and edit links, so if you'd rather keep the client read-only, send them a link's read-only stats page or a CSV export of the campaign analytics instead.",
      },
      {
        question: "Can a client see the numbers without an account?",
        answer:
          "Yes. Turn on sharing for a link on its analytics page and send the address. The client sees clicks over time, countries, devices and traffic sources. Free accounts' shared pages show the last 7 days; on Pro and Ultra the client can pick the date range. Turning sharing off stops the address working at once.",
      },
      {
        question: "Is iShortn white label?",
        answer:
          "Partly. Links and QR codes can run on the client's own domain, so the link their customers see has no iShortn name in it. The dashboard carries the iShortn name, and there's no reseller portal or custom-branded login.",
      },
      {
        question: "What file format do the QR codes download in?",
        answer:
          "A high-resolution PNG, or an SVG for engraving, vinyl and large-format print. Effects such as crystalize and liquidify are PNG only. There's no PDF export.",
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
  events: {
    slug: "events",
    name: "Events and posters",
    footerLabel: "Events",
    hubBlurb: "Poster and registration codes you can change after printing.",
    metaTitle: "QR Codes for Events and Posters | iShortn",
    metaDescription:
      "Dynamic QR codes for event posters, flyers and registration forms. Change the link after printing, close sign-ups on a date and see scans for each poster.",
    keywords: [
      "qr code for events",
      "qr code for event registration",
      "qr code for posters",
      "event qr code",
      "qr code for event flyer",
      "how big should a qr code be on a poster",
    ],
    updatedOn: "2026-11-21",
    eyebrow: "Events and posters",
    icon: IconCalendarEventFilled,
    h1: "QR codes for events and posters",
    subhead:
      "Put one code on the poster and point it at registration. After the event, send the same code to the photos or a feedback form, and see which posters people scanned.",
    heroPoints: [
      `${freeQrCodes} dynamic QR codes free`,
      "Change the link after printing",
      "No ads when people scan",
    ],
    heroCta: "Create a free event code",
    benefitsTitle: "Posters that keep working after the event",
    benefits: [
      {
        title: "One code from registration to the photos",
        body: "The code on the poster holds a short link you control. Point it at the registration form before the event, the schedule on the day and the photos or a feedback form afterwards. Posters stay up for weeks, so people who scan late still land on a page that makes sense.",
        icon: IconEditFilled,
      },
      {
        title: "A code for each poster spot",
        body: `Give the café window, the noticeboard and the handout flyers their own codes and compare them. Scans show the day, country, city and device. Free accounts see the last ${freeDays} days, and Pro keeps the full history.`,
        icon: IconMapPinFilled,
      },
      {
        title: "Registration that closes on time",
        body: "A link can stop working at a set date or after a number of visits. People who scan after the deadline see an expired page instead of a form that still takes sign-ups. Expiry works on every plan, including Free.",
        icon: IconHourglassFilled,
      },
      {
        title: "Print early, go live later",
        body: 'On Pro you can schedule a link to go live at a set time. Print the posters before registration opens, and anyone who scans early sees a "not live yet" page until then.',
        icon: IconClockFilled,
      },
      {
        title: "Codes that don't switch off",
        body: "Some QR generators turn dynamic codes off when a trial or subscription ends, and every printed poster stops working with them. iShortn's free dynamic codes have no expiry date and keep working without a paid plan.",
        icon: IconShieldCheckFilled,
      },
    ],
    howToTitle: "Set up a poster code in four steps",
    howTo: [
      {
        title: "Pick the page",
        body: "Use your registration form, ticket page or event page. iShortn doesn't sell tickets or take registrations. It sends each scan to the tool that does.",
      },
      {
        title: "Create the code",
        body: "Paste the link, add your logo and colours, and download a high-resolution PNG.",
      },
      {
        title: "Print and test",
        body: "A code scans from about ten times its own width, so a poster read from 2 metres needs a code about 20 cm wide. Scan a printed copy from that distance before you print the full run.",
      },
      {
        title: "Repoint it after the event",
        body: "Change the destination to the photos, a recap or the next date. The posters still on the walls open the new page.",
      },
    ],
    plans: [
      {
        plan: "free",
        title: "Free",
        body: `Up to ${freeQrCodes} codes and ${freeDays} days of scan data, with expiry dates on every link. Enough for one event's posters and flyers.`,
      },
      {
        plan: "pro",
        title: `Pro, ${proMonthly} a month, or ${usd(PLAN_PRICES_ANNUAL_USD.pro)} a year`,
        body: "Unlimited codes, scheduled go-live, your own domain such as go.yourevent.com and the full scan history. For clubs and venues that run events all year.",
      },
      {
        plan: "ultra",
        title: `Ultra, ${usd(PLAN_PRICES_USD.ultra)} a month`,
        body: "A shared team workspace where organisers and volunteers manage the codes together. Members join free.",
      },
    ],
    plansNote: `Free records ${count(free.eventsLimit)} scans, clicks and bio page views a month across your account, and Pro records ${count(PLAN_CAPS.pro.eventsLimit)}. Past that, codes keep working, but new scans aren't counted until the next month.`,
    faqs: [
      {
        question: "Is an event QR code free with iShortn?",
        answer: `Yes. The free plan includes ${freeQrCodes} dynamic QR codes with no ads and no expiry date, and you can change where each one points at any time. Each code uses one of your ${freeLinks} free links a month. For more codes, Pro is ${proMonthly} a month.`,
      },
      {
        question: "How big should a QR code be on a poster?",
        answer:
          "A code scans well from about ten times its own width. For a poster read from 2 metres away, make it about 20 cm wide. On a handout read at arm's length, 2.5 to 3 cm is enough. Print one copy at full size and scan it from where people will stand.",
      },
      {
        question: "How do I make a QR code for event registration?",
        answer:
          "Copy the link to your registration form or ticket page, whether that's Google Forms, Eventbrite or your own site. Paste it into a new QR code in iShortn and download the PNG. iShortn doesn't sell tickets or collect registrations. It sends each scan to your form and counts the scans.",
      },
      {
        question: "Can the code stop sign-ups when the event is full?",
        answer:
          "Partly. A link can close after a number of visits, but a visit isn't a finished sign-up, because some people scan and never register. To cap numbers, use the limit in your form or ticketing tool, and use the link's expiry date for the deadline.",
      },
      {
        question: "Will the code stop working after the event?",
        answer:
          "Only if you set an expiry. Dynamic codes made on the free plan have no expiry date of their own and keep working without a paid plan. Point the code at the photos, a recap or the next date, and old posters still lead somewhere useful.",
      },
      {
        question: "Can I check people in at the door with iShortn?",
        answer:
          "No. iShortn doesn't scan tickets or keep a guest list, so use your ticketing tool's check-in app for that. An iShortn code can send people to the schedule, the venue map or a feedback form once they're inside.",
      },
      {
        question: "Can the code use my own domain, like go.yourevent.com?",
        answer:
          "Yes, on Pro and Ultra. Add the subdomain in the dashboard and create the DNS records it shows. iShortn handles the SSL certificate.",
      },
    ],
    related: [
      { href: "/blog/qr-code-for-flyers", label: "Put a QR code on a flyer" },
      { href: "/qr-code-generator", label: "Free QR code generator" },
      { href: "/blog/how-to-track-qr-code-scans", label: "How to track QR code scans" },
      { href: "/blog/qr-code-stopped-working", label: "Why QR codes stop working" },
      { href: "/docs/short-links", label: "Expiry and scheduling in the docs" },
    ],
    ctaTitle: "Make your first event code",
    ctaBody: `The free plan has ${freeQrCodes} dynamic QR codes with no ads and no expiry date. No credit card needed.`,
    ctaButton: "Create a free QR code",
  },
  "real-estate": {
    slug: "real-estate",
    name: "Real estate agents",
    footerLabel: "Real estate",
    hubBlurb: "Sign and open house codes you repoint for each listing.",
    metaTitle: "QR Codes for Real Estate Signs and Open Houses | iShortn",
    metaDescription:
      "Dynamic QR codes for yard signs, sign riders, flyers and open houses. Point a sign at the next listing without reprinting, and see how many people scanned it.",
    keywords: [
      "real estate sign qr code",
      "open house qr code",
      "qr code for real estate",
      "qr code for realtors",
      "real estate sign rider qr code",
      "qr code for real estate flyer",
    ],
    updatedOn: "2026-11-21",
    eyebrow: "Real estate",
    icon: IconHomeFilled,
    h1: "QR codes for real estate signs and open houses",
    subhead:
      "Put a code on the yard sign, the rider and the open house flyer. When the sign moves to the next property, point the code at the new listing. You can also see how many people scanned at each address.",
    heroPoints: [
      `${freeQrCodes} dynamic QR codes free`,
      "A new listing behind the same sign",
      "No ads when buyers scan",
    ],
    heroCta: "Create a free sign code",
    benefitsTitle: "One sign, many listings",
    benefits: [
      {
        title: "Move the sign, keep the code",
        body: "Each code holds a short link you control. When the sign or rider goes up at a new property, change the destination to the new listing page. The code on the sign stays the same, so you only print it once.",
        icon: IconEditFilled,
      },
      {
        title: "See which signs get scanned",
        body: `Give each sign, rider and flyer its own code and compare them. Scans show the day, country, city and device. Free accounts see the last ${freeDays} days, and Pro keeps the full history.`,
        icon: IconMapPinFilled,
      },
      {
        title: "An open house code by the door",
        body: "Point a code at your sign-in form or the listing details and put it at the entrance. iShortn doesn't collect visitor details. The code opens the form you already use, and after the open house you point it at the next one.",
        icon: IconKeyFilled,
      },
      {
        title: "Your name in the link",
        body: `On Pro, codes and links can run on your own domain, like go.yourname.com/maple-st, so buyers can see where a code goes before they open it. Pro includes ${proDomains} custom domains, and iShortn issues the SSL certificate.`,
        icon: IconWorldFilled,
      },
      {
        title: "Codes that don't switch off",
        body: "Some QR generators turn dynamic codes off when a trial or subscription ends, and every sign and flyer stops working with them. iShortn's free dynamic codes have no expiry date and keep working without a paid plan.",
        icon: IconShieldCheckFilled,
      },
    ],
    howToTitle: "Set up a sign code in four steps",
    howTo: [
      {
        title: "Pick the listing page",
        body: "Use the listing on your website, your brokerage's site or a property portal. iShortn has no MLS connection or listing feed, so you paste each listing link yourself.",
      },
      {
        title: "Create the code",
        body: "Paste the link, add your logo and brand colours, and download a high-resolution PNG for the sign maker, or an SVG for large signs and engraving.",
      },
      {
        title: "Print and test",
        body: "Make the code as large as the sign allows. A code scans from about ten times its own width, so a 15 cm code works from about 1.5 metres. Scan the printer's proof before the full order.",
      },
      {
        title: "Repoint it for the next listing",
        body: "When the sign moves, change the destination in the dashboard and the same sign opens the new listing.",
      },
    ],
    plans: [
      {
        plan: "free",
        title: "Free",
        body: `Up to ${freeQrCodes} codes and ${freeDays} days of scan data. Enough for a few signs and an open house flyer.`,
      },
      {
        plan: "pro",
        title: `Pro, ${proMonthly} a month, or ${usd(PLAN_PRICES_ANNUAL_USD.pro)} a year`,
        body: `Unlimited codes, ${proDomains} custom domains, the full scan history and scheduled links. For agents with more than ${freeQrCodes} signs and flyers out at once.`,
      },
      {
        plan: "ultra",
        title: `Ultra, ${usd(PLAN_PRICES_USD.ultra)} a month`,
        body: "A shared team workspace for a brokerage or team, with every agent's codes in one place. Members join free.",
      },
    ],
    plansNote: `Each QR code also uses one short link from the monthly allowance: ${freeLinks} on Free, ${count(PLAN_CAPS.pro.linksLimit)} on Pro and ${count(PLAN_CAPS.ultra.linksLimit)} on Ultra.`,
    faqs: [
      {
        question: "Can I reuse the QR code on my sign for the next listing?",
        answer:
          "Yes. The printed code holds a short link, not the listing. Change where the link points in the dashboard and the same sign opens the new listing.",
      },
      {
        question: "Is a real estate QR code free with iShortn?",
        answer: `Yes. The free plan includes ${freeQrCodes} dynamic QR codes with no ads and no expiry date, and you can repoint each one at any time. Each code uses one of your ${freeLinks} free links a month. For more signs, Pro is ${proMonthly} a month.`,
      },
      {
        question: "How do I make an open house QR code?",
        answer:
          "Paste the link to your sign-in form, booking page or the listing, download the code and print it on the open house sign or flyer. iShortn doesn't store visitor details. The form you link to does.",
      },
      {
        question: "Does iShortn connect to the MLS or my listing feed?",
        answer:
          "No. iShortn has no MLS connection or listing feed. You paste the link for each listing and change it yourself when a sign moves.",
      },
      {
        question: "Can one code show all my listings?",
        answer: `Yes, if you point it at a bio page with your current listings, your reviews and a booking link. The free bio page holds up to ${count(free.bioLinkBlocksPerPageLimit)} link blocks. Pro has no block limit, removes the iShortn badge and can put the page on your own domain.`,
      },
      {
        question: "Do the codes expire?",
        answer:
          "No. A dynamic code has no expiry date unless you set one, and codes made on the free plan keep working without a paid plan.",
      },
      {
        question: "Can my team or brokerage share the codes?",
        answer:
          "Yes, on Ultra. The owner creates a team workspace and invites agents as admins or members. Members don't need a paid plan.",
      },
    ],
    related: [
      { href: "/blog/qr-code-for-flyers", label: "Put a QR code on a flyer" },
      { href: "/blog/qr-code-for-google-reviews", label: "Make a QR code for Google reviews" },
      { href: "/blog/how-to-track-qr-code-scans", label: "How to track QR code scans" },
      { href: "/docs/custom-domains", label: "Custom domains" },
      { href: "/qr-code-generator", label: "Free QR code generator" },
    ],
    ctaTitle: "Make your first sign code",
    ctaBody: `The free plan has ${freeQrCodes} dynamic QR codes with no ads and no expiry date. No credit card needed.`,
    ctaButton: "Create a free QR code",
  },
} satisfies Record<string, Solution>;

// Display order for the hub, the footer and /features.
export const solutionList: Solution[] = [
  solutions.restaurants,
  solutions["small-business"],
  solutions.creators,
  solutions["churches-and-nonprofits"],
  solutions.agencies,
  solutions.events,
  solutions["real-estate"],
];

export const getSolution = (slug: string): Solution | undefined =>
  solutionList.find((solution) => solution.slug === slug);

export const signUpHref = (slug: string, placement: "hero" | "cta") =>
  `/auth/sign-up?utm_source=site&utm_medium=solutions&utm_campaign=${slug}&utm_content=${placement}`;
