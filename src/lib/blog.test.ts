import { describe, expect, it } from "bun:test";

import { getAllPosts, getPostBySlug, getRelatedPosts, isPostVisible } from "./blog";

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
});
