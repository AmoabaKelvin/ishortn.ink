import { describe, expect, it } from "bun:test";

import { getAllPosts, getPostBySlug, getRelatedPosts, isPostVisible, renderPostBody } from "./blog";

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

describe("renderPostBody", () => {
  // bitly-alternatives is dated 2026-03-01, short-io-alternatives 2026-12-09.
  it("links live posts and renders links to scheduled posts as text", async () => {
    const body = await renderPostBody(
      "See [Bitly alternatives](/blog/bitly-alternatives) and [Short.io alternatives](/blog/short-io-alternatives).",
      now,
    );
    expect(body).toContain('<a href="/blog/bitly-alternatives">Bitly alternatives</a>');
    expect(body).toContain("and Short.io alternatives.");
    expect(body).not.toContain("short-io-alternatives");
  });

  it("links a scheduled post once its date arrives", async () => {
    const body = await renderPostBody(
      "[Short.io alternatives](/blog/short-io-alternatives/#pricing)",
      new Date("2026-12-09T00:00:00Z"),
    );
    expect(body).toContain('<a href="/blog/short-io-alternatives/#pricing">');
  });

  it("unlinks absolute and autolinked URLs to scheduled or missing posts, keeping formatting", async () => {
    const body = await renderPostBody(
      "- [**Short.io**](https://www.ishortn.ink/blog/short-io-alternatives?ref=x)\n- https://ishortn.ink/blog/no-such-post",
      now,
    );
    expect(body).not.toContain("<a ");
    expect(body).toContain("<li><strong>Short.io</strong></li>");
    expect(body).toContain("<li>https://ishortn.ink/blog/no-such-post</li>");
  });

  it("leaves external, non-post and blog index links alone", async () => {
    const body = await renderPostBody(
      "[a](https://example.com/blog/short-io-alternatives) [b](/docs/api) [c](/blog) [d](#faq)",
      now,
    );
    expect(body).toContain('<a href="https://example.com/blog/short-io-alternatives">a</a>');
    expect(body).toContain('<a href="/docs/api">b</a>');
    expect(body).toContain('<a href="/blog">c</a>');
    expect(body).toContain('<a href="#faq">d</a>');
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
