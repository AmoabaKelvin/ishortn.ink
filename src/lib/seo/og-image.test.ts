import { describe, expect, it } from "bun:test";

import { defaultOgImage, socialImages } from "./og-image";

describe("socialImages", () => {
  it("defaults to the absolute site card at 1200x630", () => {
    expect(socialImages()).toEqual([
      {
        url: "https://ishortn.ink/opengraph-image",
        width: 1200,
        height: 630,
        alt: "iShortn - Free URL Shortener with Analytics",
        type: "image/png",
      },
    ]);
  });

  it("keeps a page's own image", () => {
    expect(socialImages("https://ishortn.ink/blog/cover.png")).toEqual([
      { url: "https://ishortn.ink/blog/cover.png" },
    ]);
  });

  it("treats an empty image as missing", () => {
    expect(socialImages("")).toEqual([defaultOgImage]);
  });
});
