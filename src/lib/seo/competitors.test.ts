import { describe, expect, it } from "bun:test";

import { isPostSlugVisible } from "@/lib/blog";

import { competitors } from "./competitors";

describe("competitor guides", () => {
  // A typo'd slug would never become visible, so the link would silently never render.
  it("point at real blog posts", () => {
    const farFuture = new Date("2100-01-01T00:00:00Z");
    for (const competitor of Object.values(competitors)) {
      if (!("guide" in competitor)) continue;
      expect(isPostSlugVisible(competitor.guide.slug, farFuture)).toBe(true);
    }
  });
});
