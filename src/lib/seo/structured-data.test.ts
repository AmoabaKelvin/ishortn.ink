import { describe, expect, it } from "bun:test";

import { defaultOgImage } from "./og-image";
import { createArticleSchema } from "./structured-data";

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
    expect(createArticleSchema(article).image).toBe(defaultOgImage.url);
    expect(createArticleSchema({ ...article, image: "" }).image).toBe(defaultOgImage.url);
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
