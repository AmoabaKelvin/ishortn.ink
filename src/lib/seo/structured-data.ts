import { FREE_QR_CODE_LIMIT } from "@/lib/billing/entitlements";
import { PLAN_CAPS } from "@/lib/billing/plans";
import { PLAN_PRICES_USD } from "@/lib/constants/plan-pricing";
import { ROOT_OG_IMAGE_URL } from "@/lib/seo/og-image";

export type JsonLdValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly JsonLdValue[]
  | { readonly [key: string]: JsonLdValue };

/** A schema.org node as embedded by `<JsonLd>`. */
export type JsonLdNode = { readonly [key: string]: JsonLdValue };

/** Plan limit as written in copy ("1,000"); undefined (unlimited) never reaches these. */
export const formatCount = (n: number | undefined) => (n ?? 0).toLocaleString("en-US");
export const pluralize = (n: number | undefined, word: string) =>
  `${formatCount(n)} ${word}${n === 1 ? "" : "s"}`;

const SITE_DESCRIPTION = `URL shortener with click analytics, custom domains, dynamic QR codes and link-in-bio pages. Free plan; Pro $${PLAN_PRICES_USD.pro} a month.`;
const PRICING_URL = "https://ishortn.ink/pricing";
const { free, pro } = PLAN_CAPS;

export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "iShortn",
  url: "https://ishortn.ink",
  logo: "https://ishortn.ink/icon.png",
  sameAs: [
    "https://x.com/ishortn_ink",
    "https://www.linkedin.com/company/ishortn",
    "https://github.com/AmoabaKelvin/ishortn.ink",
  ],
  description: SITE_DESCRIPTION,
};

export const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "iShortn",
  url: "https://ishortn.ink",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "URL shortener",
  operatingSystem: "Web",
  description: SITE_DESCRIPTION,
  featureList: [
    "Short links with custom aliases",
    "Click analytics: countries, cities, devices, referrers",
    "Custom domains",
    "Dynamic QR codes that never expire",
    "Link-in-bio pages",
    "Geo and device targeting",
    "Password-protected and expiring links",
    "Bulk CSV import, including Bitly exports",
    "REST API",
    "Team workspaces",
  ],
  // Prices and limits derive from the billing source of truth so the JSON-LD can't drift.
  offers: [
    {
      "@type": "Offer",
      price: String(PLAN_PRICES_USD.free),
      priceCurrency: "USD",
      name: "Free",
      url: PRICING_URL,
      description: `${formatCount(free.linksLimit)} links a month, ${free.analyticsRangeLimitDays}-day analytics, ${FREE_QR_CODE_LIMIT} dynamic QR codes that never expire, ${pluralize(free.bioPageLimit, "link-in-bio page")}`,
    },
    {
      "@type": "Offer",
      price: String(PLAN_PRICES_USD.pro),
      priceCurrency: "USD",
      name: "Pro",
      url: PRICING_URL,
      description: `${formatCount(pro.linksLimit)} links a month, 1 year of detailed analytics, ${pluralize(pro.domainLimit, "custom domain")}, link-in-bio on your domain, REST API`,
    },
    {
      "@type": "Offer",
      price: String(PLAN_PRICES_USD.ultra),
      priceCurrency: "USD",
      name: "Ultra",
      url: PRICING_URL,
      description: "Unlimited links, tracked clicks and custom domains, team workspaces",
    },
  ],
};

export function createFaqSchema(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "iShortn",
  url: "https://ishortn.ink",
  description: "Free URL shortener with powerful analytics, custom domains, and QR codes.",
  publisher: {
    "@type": "Organization",
    name: "iShortn",
    url: "https://ishortn.ink",
  },
};

/** A free in-browser tool page (UTM builder, generators). */
export function createWebApplicationSchema(app: {
  name: string;
  url: string;
  description: string;
  /** BCP 47 tag, for pages not in English. */
  inLanguage?: string;
  applicationCategory?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: app.name,
    url: app.url,
    description: app.description,
    ...(app.inLanguage && { inLanguage: app.inLanguage }),
    applicationCategory: app.applicationCategory ?? "BusinessApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@type": "Organization", name: "iShortn", url: "https://ishortn.ink" },
  };
}

export function createBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function createItemListSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

export function createArticleSchema(article: {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified: string;
  author: string;
  image?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    url: article.url,
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    author: {
      "@type": "Person",
      name: article.author,
      // Posts carry no per-author page, so the author links to the site.
      url: "https://ishortn.ink",
    },
    publisher: {
      "@type": "Organization",
      name: "iShortn",
      logo: {
        "@type": "ImageObject",
        url: "https://ishortn.ink/icon.png",
      },
    },
    // Google's Article guidelines expect an image; posts without a cover use the site card.
    image: article.image ? new URL(article.image, "https://ishortn.ink").href : ROOT_OG_IMAGE_URL,
  };
}
