import { describe, expect, it } from "bun:test";

import { ogCardAlt, socialImages } from "./og-image";

describe("socialImages", () => {
  it("describes the card as an absolute 1200x630 PNG with alt text", () => {
    expect(socialImages("https://ishortn.ink/opengraph-image", ogCardAlt("Home"))).toEqual([
      {
        url: "https://ishortn.ink/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Home | iShortn",
        type: "image/png",
      },
    ]);
  });
});
