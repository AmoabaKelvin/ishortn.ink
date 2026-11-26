import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

import {
  extractFaqs,
  getAllPosts,
  getPostBySlug,
  getRelatedPosts,
  isPostLive,
  isPostVisible,
  renderPostBody,
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

describe("extractFaqs", () => {
  it("reads questions and answers from a ## FAQ section", () => {
    const faqs = extractFaqs(
      "## Intro\n\nText.\n\n## FAQ\n\n### Is it free?\n\nYes, *mostly*.\n\n### Can I export?\n\n**Yes.**\n",
    );
    expect(faqs).toEqual([
      { question: "Is it free?", answer: "Yes, mostly." },
      { question: "Can I export?", answer: "Yes." },
    ]);
  });

  it("matches Common questions about X, Frequently asked questions and Questions", () => {
    const body = "\n\n### Q one?\n\nA one.\n\n### Q two?\n\nA two.\n";
    for (const heading of [
      "Common questions about Bitly alternatives",
      "Frequently Asked Questions",
      "Questions",
      "questions and answers",
    ]) {
      expect(extractFaqs(`## ${heading}${body}`)).toEqual([
        { question: "Q one?", answer: "A one." },
        { question: "Q two?", answer: "A two." },
      ]);
    }
  });

  it("ends answers at the next ### and the section at the next ##", () => {
    const faqs = extractFaqs(
      [
        "## FAQs",
        "### First?",
        "See [our docs](https://example.com/docs) for `curl` usage.",
        "It takes a minute.",
        "- one\n- two",
        "### Second?",
        "Short.",
        "## Conclusion",
        "Not an answer.",
        "### Not a question?",
        "Nope.",
      ].join("\n\n"),
    );
    expect(faqs).toEqual([
      { question: "First?", answer: "See our docs for curl usage. It takes a minute. one two" },
      { question: "Second?", answer: "Short." },
    ]);
  });

  it("skips empty answers and ignores non-FAQ sections", () => {
    expect(extractFaqs("## FAQ\n\n### Empty?\n\n### Full?\n\nYes.")).toEqual([
      { question: "Full?", answer: "Yes." },
    ]);
    expect(extractFaqs("## Common mistakes\n\n### Using HTTP\n\nDon't.")).toEqual([]);
    expect(extractFaqs("No headings at all.")).toEqual([]);
  });

  it("extracts the FAQ sections of real posts", async () => {
    const bitly = await getPostBySlug("bitly-alternatives");
    expect(bitly!.faqs.length).toBeGreaterThanOrEqual(4);
    expect(bitly!.faqs[0]!.question).toBe("Is there a free alternative to Bitly?");
    const whatIs = await getPostBySlug("what-is-a-url-shortener");
    expect(whatIs!.faqs.length).toBeGreaterThanOrEqual(2);
    // Read from disk rather than getPostBySlug so scheduled posts are covered before their date.
    const faqsOf = (slug: string) => extractFaqs(readFileSync(`content/blog/${slug}.md`, "utf8"));
    const packaging = faqsOf("qr-code-on-product-packaging");
    expect(packaging.length).toBe(5);
    expect(packaging[0]!.question).toBe("What size should a QR code on a product label be?");
    const cancel = faqsOf("cancel-bitly-subscription");
    expect(cancel.length).toBe(5);
    expect(cancel[0]!.question).toBe("Do Bitly links stop working if I cancel?");
  });
});

describe("isPostLive", () => {
  // linktree-custom-domain is scheduled for 2026-11-23.
  it("hides a scheduled post until its UTC publish day", () => {
    expect(isPostLive("linktree-custom-domain", new Date("2026-11-22T23:59:59Z"))).toBe(false);
    expect(isPostLive("linktree-custom-domain", new Date("2026-11-23T00:00:00Z"))).toBe(true);
  });

  it("shows a published post and hides unknown slugs", () => {
    expect(isPostLive("bitly-alternatives", now)).toBe(true);
    expect(isPostLive("no-such-post", now)).toBe(false);
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
        expect({ from: post.slug, to: target, visible: isPostLive(target!) }).toEqual({
          from: post.slug,
          to: target,
          visible: true,
        });
      }
    }
  }, 30_000);
});
