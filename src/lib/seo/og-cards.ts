import { formatUsd } from "@/lib/billing/pricing";
import { PAID_PLANS, PLAN_PRICES_USD } from "@/lib/constants/plan-pricing";
import { DOCS_BASE_PATH } from "@/lib/docs/navigation";

import { ogCardAlt } from "./og-image";

import type { Competitor } from "./competitors";
import type { OgCard, OgCardProps } from "./og-image";
import type { Solution } from "./solutions";

function card(props: OgCardProps): OgCard {
  return { ...props, alt: ogCardAlt(props.title) };
}

const lowestPaidPrice = Math.min(...PAID_PLANS.map((plan) => PLAN_PRICES_USD[plan]));

// Social cards of the landing pages. Titles are the pages' H1s and subtitles their hero leads
// (og-cards.test.ts keeps them in sync with the page source).
export const pageCards = {
  home: card({
    title: "Free URL shortener with click tracking",
    subtitle: "Short links, branded domains, QR codes, bio pages, analytics and team workspaces.",
    visual: "links",
  }),
  pricing: card({
    eyebrow: "Pricing",
    title: "Plans that grow with your links",
    subtitle: `Free forever. Paid plans from $${formatUsd(lowestPaidPrice)}/month.`,
  }),
  features: card({
    eyebrow: "Features",
    title: "Everything you need to manage your links",
    subtitle:
      "Real-time analytics, custom domains, branded QR codes, and bulk shortening in one place.",
    visual: "links",
  }),
  solutions: card({
    eyebrow: "Solutions",
    title: "Short links and QR codes for your line of work",
    subtitle: "Pick your field to see what iShortn does for it, which plan fits and what it costs.",
  }),
  compare: card({
    eyebrow: "Compare",
    title: "Link shorteners compared: free plans and prices",
    subtitle: "Free-plan limits, custom domains, QR codes and prices, side by side.",
  }),
  openSourceUrlShortener: card({
    eyebrow: "MIT licence",
    title: "Open-source URL shortener",
    subtitle:
      "Self-host it on Cloudflare Workers or use the free hosted plan. Open-source shorteners compared.",
  }),
  changelog: card({
    eyebrow: "Changelog",
    title: "What's new in iShortn",
    subtitle: "Every release in order. New features, improvements, and fixes.",
  }),
  blog: card({
    eyebrow: "Blog",
    title: "Guides and updates from iShortn",
    subtitle:
      "Product updates, guides, and deep dives on link management, analytics, and digital marketing.",
  }),
  abuse: card({
    eyebrow: "Report abuse",
    title: "Report a link that breaks the rules",
    subtitle:
      "Tell us about a short link used for phishing, malware, spam, or impersonation, and we will review it and disable links that violate our policies.",
  }),
  terms: card({
    eyebrow: "Legal",
    title: "Terms of service",
    subtitle: "The terms and conditions for using the iShortn URL shortening service.",
  }),
  privacy: card({
    eyebrow: "Legal",
    title: "Privacy policy",
    subtitle: "How iShortn collects, uses, and protects your personal information.",
  }),
  qrCodeGenerator: card({
    eyebrow: "Free tool",
    title: "Free QR code generator that doesn't expire",
    subtitle: "Paste a link and download a QR code in seconds. No account, no ads, no expiry date.",
    visual: "qr",
  }),
  utmBuilder: card({
    eyebrow: "Free tool",
    title: "Free UTM builder for campaign links",
    subtitle:
      "Add UTM tags to any link so Google Analytics shows which post, email or ad sent each visitor.",
    visual: "links",
    visualLabel: "example.com/sale?utm_source=newsletter&utm_medium=email&utm_campaign=spring",
  }),
  urlExpander: card({
    eyebrow: "Free tool",
    title: "URL expander",
    subtitle: "Paste a short link to see where it really goes.",
    visual: "links",
    visualLabel: "Final page: https://example.com/spring-launch",
  }),
  extension: card({
    eyebrow: "Browser extension",
    title: "iShortn for Chrome",
    subtitle:
      "Shorten the current tab in one click, copy the link and get its QR code, right from your browser toolbar.",
    visual: "links",
    visualLabel: "ishortn.ink/q4Lx9",
  }),
  whatsappLinkGenerator: card({
    eyebrow: "Free tool",
    title: "Free WhatsApp link generator",
    subtitle: "Make a wa.me link with your message already typed in, plus a QR code to print.",
    visual: "links",
    visualLabel: "wa.me/447700900123?text=Hi%2C%20I%27d%20like%20to%20order",
  }),
  whatsappLinkGeneratorPtBr: card({
    eyebrow: "Ferramenta grátis",
    title: "Gerador de link do WhatsApp grátis",
    subtitle: "Crie um link wa.me com a mensagem já escrita e um QR code para imprimir.",
    visual: "links",
    visualLabel: "wa.me/5511912345678?text=Ol%C3%A1!%20Quero%20fazer%20um%20pedido.",
  }),
} satisfies Record<string, OgCard>;

export function solutionCard(solution: Solution): OgCard {
  return card({
    eyebrow: "Solutions",
    title: solution.h1,
    subtitle: solution.hubBlurb,
    // Every solution but link in bio leads with QR codes.
    visual: solution.h1.startsWith("QR codes") ? "qr" : "links",
  });
}

export function comparisonCard(competitor: Competitor): OgCard {
  return card({
    eyebrow: "Compare",
    title: `iShortn vs ${competitor.name}`,
    subtitle: `A side-by-side ${competitor.category} comparison of features, free plans and pricing.`,
    visual: "compare",
    visualLabel: competitor.name,
  });
}

export function blogPostCard(post: { title: string; author: string; date: string }): OgCard {
  const date = new Date(post.date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return card({
    eyebrow: "Blog",
    title: post.title,
    subtitle: `${post.author} · ${date}`,
  });
}

// One image per docs page, served by docs-site/og/[id]/route.tsx. Ids are single path segments,
// so nested slugs ("api/create-link") swap "/" for "-".
export function docsOgImageId(slug: string): string {
  return slug ? slug.replaceAll("/", "-") : "index";
}

// The public /docs path, which the middleware rewrites to the internal docs-site route: robots.txt
// disallows the internal path, and social crawlers skip images it blocks.
export function docsOgImageUrl(slug: string): string {
  return `https://ishortn.ink${DOCS_BASE_PATH}/og/${docsOgImageId(slug)}`;
}

export function docsCard(page: { slug: string; title: string; description: string }): OgCard {
  return {
    eyebrow: "Docs",
    title: page.slug ? page.title : "Documentation",
    subtitle: page.description,
    alt: ogCardAlt(page.slug ? `${page.title} · Docs` : "Documentation"),
  };
}
