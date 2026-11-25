import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { fillMetadataSegment } from "next/dist/lib/metadata/get-metadata-route";

import { getPublishedPostsFrontmatter } from "@/lib/blog";
import { DOCS_PAGES } from "@/lib/docs/navigation";

import { competitors } from "./competitors";
import {
  blogPostCard,
  comparisonCard,
  docsOgImageId,
  docsOgImageUrl,
  pageCards,
  solutionCard,
} from "./og-cards";
import { ROOT_OG_IMAGE_URL } from "./og-image";
import { solutionList } from "./solutions";

const LANDING = join(process.cwd(), "src/app/(landing)");

// Next.js generates the URL of each opengraph-image file (with a path hash under route groups)
// and writes it into the page's og:image and twitter:image. These are the URLs it produces.
const cardUrl = (segment: string, params: Record<string, string> = {}) =>
  `https://ishortn.ink${fillMetadataSegment(segment, params, "opengraph-image", false)}`;

describe("card image URLs", () => {
  it("serves each page's own card", () => {
    expect(ROOT_OG_IMAGE_URL).toBe(cardUrl("/"));
    expect(cardUrl("/(landing)/pricing")).toBe(
      "https://ishortn.ink/pricing/opengraph-image-ksgzml",
    );
    expect(cardUrl("/(landing)/solutions/[slug]", { slug: "restaurants" })).toBe(
      "https://ishortn.ink/solutions/restaurants/opengraph-image-1cvqpb",
    );
    expect(cardUrl("/(landing)/compare/[slug]", { slug: "bitly" })).toBe(
      "https://ishortn.ink/compare/bitly/opengraph-image-bkavi2",
    );
  });

  it("links docs cards through the public /docs path", () => {
    expect(docsOgImageUrl("api/create-link")).toBe("https://ishortn.ink/docs/og/api-create-link");
    expect(docsOgImageUrl("")).toBe("https://ishortn.ink/docs/og/index");
  });

  it("gives every docs page a distinct image id", () => {
    const ids = DOCS_PAGES.map((page) => docsOgImageId(page.slug));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every card alt text naming the page", () => {
    expect(pageCards.pricing.alt).toBe("Plans that grow with your links | iShortn");
    expect(comparisonCard(competitors.dub).alt).toBe("iShortn vs Dub.co | iShortn");
  });

  // A page that sets `openGraph.images` (or `twitter.images`) overrides the card next to it.
  it("puts a card next to every landing page and leaves its URL to Next.js", () => {
    const pages = new Bun.Glob("**/page.tsx").scanSync(LANDING);
    for (const page of pages) {
      if (page === "page.tsx") continue; // Home uses the root card (ROOT_OG_IMAGE_URL).
      expect(existsSync(join(LANDING, dirname(page), "opengraph-image.tsx"))).toBe(true);
      expect(readFileSync(join(LANDING, page), "utf8")).not.toContain("socialImages(");
    }
  });
});

describe("card copy", () => {
  it("states the cheapest paid plan from the billing prices", () => {
    expect(pageCards.pricing.subtitle).toBe("Free forever. Paid plans from $8/month.");
  });

  it("uses the solution's headline and blurb", () => {
    for (const solution of solutionList) {
      const card = solutionCard(solution);
      expect(card.title).toBe(solution.h1);
      expect(card.subtitle).toBe(solution.hubBlurb);
    }
  });

  it("dates blog cards in UTC", () => {
    const card = blogPostCard({
      slug: "x",
      title: "X",
      author: "Kelvin Amoaba",
      date: "2026-03-01",
    });
    expect(card.subtitle).toBe("Kelvin Amoaba · March 1, 2026");
  });

  it("has a card for every published post", () => {
    expect(getPublishedPostsFrontmatter().length).toBeGreaterThan(0);
  });

  // The landing pages write their hero copy inline, so check the cards repeat it verbatim.
  const landing = (file: string) =>
    readFileSync(join(LANDING, file), "utf8")
      .replaceAll("&apos;", "'")
      .replace(/\s+/g, " ")
      .replace(/> | </g, (gap) => gap.trim());

  const sources = {
    home: "_components/hero.tsx",
    pricing: "pricing/page.tsx",
    features: "features/page.tsx",
    solutions: "solutions/page.tsx",
    compare: "compare/page.tsx",
    changelog: "changelog/page.tsx",
    blog: "blog/page.tsx",
    abuse: "abuse/page.tsx",
    terms: "terms/page.tsx",
    privacy: "privacy/page.tsx",
    qrCodeGenerator: "qr-code-generator/page.tsx",
    utmBuilder: "utm-builder/page.tsx",
    extension: "extension/page.tsx",
    whatsappLinkGenerator: "whatsapp-link-generator/page.tsx",
    whatsappLinkGeneratorPtBr: "gerador-de-link-whatsapp/page.tsx",
  } satisfies Record<keyof typeof pageCards, string>;

  for (const [key, file] of Object.entries(sources)) {
    it(`matches the ${key} page's H1 and lead`, () => {
      // SAFETY: `sources` satisfies Record<keyof typeof pageCards, string>, so its keys are card keys.
      const card = pageCards[key as keyof typeof pageCards];
      const source = landing(file);
      expect(source).toContain(`>${card.title}<`);
      // Home, pricing and compare write a card-length subtitle of their own (compare's lead is
      // built from the plan constants, so it isn't a literal in the page source).
      if (key !== "home" && key !== "pricing" && key !== "compare") {
        expect(source).toContain(card.subtitle);
      }
    });
  }
});
