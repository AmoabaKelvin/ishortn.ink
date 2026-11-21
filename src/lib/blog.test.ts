import { describe, expect, it } from "bun:test";

import {
  getAllPosts,
  getPostBySlug,
  getRelatedPosts,
  isPostSlugVisible,
  isPostVisible,
  unlinkHiddenPosts,
} from "./blog";

const now = new Date("2026-11-21T12:00:00Z");

describe("isPostVisible", () => {
  it("shows published posts dated today or earlier (UTC)", () => {
    expect(isPostVisible({ date: "2026-11-21", published: true }, now)).toBe(true);
    expect(isPostVisible({ date: "2025-01-01", published: true }, now)).toBe(true);
  });

  it("hides posts dated after today (UTC)", () => {
    expect(isPostVisible({ date: "2026-11-22", published: true }, now)).toBe(false);
    expect(isPostVisible({ date: "2027-01-01", published: true }, now)).toBe(false);
  });

  it("uses the UTC day, not the local one", () => {
    const lateUtc = new Date("2026-11-21T23:59:59Z");
    const earlyUtc = new Date("2026-11-22T00:00:00Z");
    expect(isPostVisible({ date: "2026-11-22", published: true }, lateUtc)).toBe(false);
    expect(isPostVisible({ date: "2026-11-22", published: true }, earlyUtc)).toBe(true);
  });

  it("hides unpublished posts regardless of date", () => {
    expect(isPostVisible({ date: "2025-01-01", published: false }, now)).toBe(false);
  });

  it("shows scheduled posts when previewing, but never unpublished ones", () => {
    expect(isPostVisible({ date: "2027-01-01", published: true }, now, true)).toBe(true);
    expect(isPostVisible({ date: "2025-01-01", published: false }, now, true)).toBe(false);
  });
});

describe("isPostSlugVisible", () => {
  // linktree-custom-domain is scheduled for 2026-11-23.
  it("hides a scheduled post until its UTC publish day", () => {
    expect(isPostSlugVisible("linktree-custom-domain", new Date("2026-11-22T23:59:59Z"))).toBe(
      false,
    );
    expect(isPostSlugVisible("linktree-custom-domain", new Date("2026-11-23T00:00:00Z"))).toBe(
      true,
    );
  });

  it("shows a published post and hides unknown slugs", () => {
    expect(isPostSlugVisible("bitly-alternatives", now)).toBe(true);
    expect(isPostSlugVisible("no-such-post", now)).toBe(false);
  });
});

describe("unlinkHiddenPosts", () => {
  const visible = (slug: string) => slug === "live";

  it("keeps links to visible posts and unwraps links to hidden ones", () => {
    expect(unlinkHiddenPosts("See [this](/blog/live) and [that](/blog/scheduled).", visible)).toBe(
      "See [this](/blog/live) and that.",
    );
  });

  it("matches links with an anchor and leaves other links alone", () => {
    expect(unlinkHiddenPosts("[a](/blog/scheduled#part) [b](/pricing) [c](/blog)", visible)).toBe(
      "a [b](/pricing) [c](/blog)",
    );
  });
});

describe("blog content", () => {
  // Renders every post through remark.
  it("lists only visible posts and agrees with slug lookup", async () => {
    const posts = await getAllPosts();
    expect(posts.length).toBeGreaterThan(0);
    for (const post of posts) {
      expect(isPostVisible(post)).toBe(true);
    }
    const related = await getRelatedPosts(posts[0]!.slug);
    for (const post of related) {
      expect(isPostVisible(post)).toBe(true);
    }
    expect(await getPostBySlug(posts[0]!.slug)).not.toBeNull();
  }, 30_000);

  it("never links a visible post to a hidden one", async () => {
    for (const post of await getAllPosts()) {
      for (const [, target] of post.htmlContent.matchAll(/href="\/blog\/([\w-]+)/g)) {
        expect({ from: post.slug, to: target, visible: isPostSlugVisible(target!) }).toEqual({
          from: post.slug,
          to: target,
          visible: true,
        });
      }
    }
  }, 30_000);
});
