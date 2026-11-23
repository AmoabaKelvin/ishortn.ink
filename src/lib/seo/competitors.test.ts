import { describe, expect, it } from "bun:test";

import { isPostLive } from "@/lib/blog";
import { DOCS_PAGES, docsHref } from "@/lib/docs/navigation";

import { competitors, getCompetitor } from "./competitors";

const farFuture = new Date("2100-01-01T00:00:00Z");

describe("competitor guides", () => {
  // A typo'd slug would never become visible, so the link would silently never render.
  it("point at real blog posts", () => {
    for (const competitor of Object.values(competitors)) {
      if (!("guide" in competitor)) continue;
      expect(isPostLive(competitor.guide.slug, farFuture)).toBe(true);
    }
  });

  it("list related guides that exist", () => {
    const docsHrefs = new Set(DOCS_PAGES.map((page) => docsHref(page.slug)));
    for (const competitor of Object.values(competitors)) {
      if (!("relatedGuides" in competitor)) continue;
      for (const { href } of competitor.relatedGuides) {
        if (href.startsWith("/blog/")) {
          expect(isPostLive(href.slice("/blog/".length), farFuture)).toBe(true);
        } else if (href.startsWith("/compare/")) {
          expect(getCompetitor(href.slice("/compare/".length))).toBeDefined();
        } else {
          expect(docsHrefs).toContain(href);
        }
      }
    }
  });
});

describe("competitor FAQs and migration steps", () => {
  it("have at least 3 complete FAQs", () => {
    for (const competitor of Object.values(competitors)) {
      if (!("faqs" in competitor)) continue;
      expect(competitor.faqs.length).toBeGreaterThanOrEqual(3);
      for (const faq of competitor.faqs) {
        expect(faq.question.trim()).not.toBe("");
        expect(faq.answer.trim()).not.toBe("");
      }
    }
  });

  it("have 3 to 7 migration steps", () => {
    for (const competitor of Object.values(competitors)) {
      if (!("migrationSteps" in competitor)) continue;
      expect(competitor.migrationSteps.length).toBeGreaterThanOrEqual(3);
      expect(competitor.migrationSteps.length).toBeLessThanOrEqual(7);
    }
  });
});
