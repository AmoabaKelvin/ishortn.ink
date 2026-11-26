import { describe, expect, it } from "bun:test";

import { FREE_QR_CODE_LIMIT } from "@/lib/billing/entitlements";
import { PLAN_CAPS } from "@/lib/billing/plans";
import { PLAN_PRICES_USD } from "@/lib/constants/plan-pricing";

import { ROOT_OG_IMAGE_URL } from "./og-image";
import {
  createArticleSchema,
  createItemListSchema,
  organizationSchema,
  softwareApplicationSchema,
} from "./structured-data";

const article = {
  title: "Bitly alternatives",
  description: "Compared.",
  url: "https://ishortn.ink/blog/bitly-alternatives",
  datePublished: "2026-03-01",
  dateModified: "2026-03-01",
  author: "Kelvin Amoaba",
};

describe("createArticleSchema", () => {
  it("falls back to the default OG image when the post has no cover", () => {
    expect(createArticleSchema(article).image).toBe(ROOT_OG_IMAGE_URL);
    expect(createArticleSchema({ ...article, image: "" }).image).toBe(ROOT_OG_IMAGE_URL);
  });

  it("uses the post's cover as an absolute URL", () => {
    expect(createArticleSchema({ ...article, image: "/blog/cover.png" }).image).toBe(
      "https://ishortn.ink/blog/cover.png",
    );
    expect(createArticleSchema({ ...article, image: "https://cdn.example.com/c.png" }).image).toBe(
      "https://cdn.example.com/c.png",
    );
  });

  it("gives the author a URL", () => {
    expect(createArticleSchema(article).author).toEqual({
      "@type": "Person",
      name: "Kelvin Amoaba",
      url: "https://ishortn.ink",
    });
  });
});

describe("createItemListSchema", () => {
  it("numbers items from 1", () => {
    const schema = createItemListSchema([
      { name: "iShortn vs Bitly", url: "https://ishortn.ink/compare/bitly" },
      { name: "iShortn vs Dub.co", url: "https://ishortn.ink/compare/dub" },
    ]);
    expect(schema["@type"]).toBe("ItemList");
    expect(schema.numberOfItems).toBe(2);
    expect(schema.itemListElement[1]).toEqual({
      "@type": "ListItem",
      position: 2,
      name: "iShortn vs Dub.co",
      url: "https://ishortn.ink/compare/dub",
    });
  });
});

describe("softwareApplicationSchema", () => {
  it("describes each offer from the plan caps", () => {
    expect(softwareApplicationSchema.offers.map((offer) => offer.description)).toEqual([
      `${PLAN_CAPS.free.linksLimit} links a month, ${PLAN_CAPS.free.analyticsRangeLimitDays}-day analytics, ${FREE_QR_CODE_LIMIT} dynamic QR codes that never expire, 1 link-in-bio page`,
      `${PLAN_CAPS.pro.linksLimit?.toLocaleString("en-US")} links a month, unlimited analytics history, ${PLAN_CAPS.pro.domainLimit} custom domains, link-in-bio on your domain, REST API`,
      "Unlimited links, events and custom domains, team workspaces",
    ]);
    for (const offer of softwareApplicationSchema.offers) {
      expect(offer.url).toBe("https://ishortn.ink/pricing");
    }
  });

  it("shares the Organization description, priced from the pricing constants", () => {
    expect(softwareApplicationSchema.description).toBe(organizationSchema.description);
    expect(organizationSchema.description).toContain(`Pro $${PLAN_PRICES_USD.pro} a month`);
  });

  it("links the Organization to its official profiles", () => {
    expect(organizationSchema.sameAs).toEqual([
      "https://x.com/ishortn_ink",
      "https://www.linkedin.com/company/ishortn",
      "https://github.com/AmoabaKelvin/ishortn.ink",
    ]);
  });
});
