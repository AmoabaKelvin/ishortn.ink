import { describe, expect, it } from "bun:test";

import {
  buildBulk,
  buildTaggedUrl,
  cleanUtmValue,
  EMPTY_UTM_VALUES,
  getShortenHref,
  MAX_BULK_URLS,
  readUtmParams,
  toCsv,
} from "./utils";

const tags = (values: Partial<typeof EMPTY_UTM_VALUES>) => ({ ...EMPTY_UTM_VALUES, ...values });

describe("buildTaggedUrl", () => {
  it("adds tags in the fixed order", () => {
    expect(
      buildTaggedUrl(
        "https://example.com/page",
        tags({
          id: "42",
          term: "shoes",
          content: "hero",
          campaign: "launch",
          medium: "email",
          source: "news",
        }),
      ),
    ).toBe(
      "https://example.com/page?utm_source=news&utm_medium=email&utm_campaign=launch&utm_content=hero&utm_term=shoes&utm_id=42",
    );
  });

  it("replaces existing utm values and keeps other params in order, fragment last", () => {
    expect(
      buildTaggedUrl(
        "example.com/pricing?a=1&utm_source=old&b=2&utm_medium=x#plans",
        tags({ source: "Newsletter", medium: "Email", campaign: "Black Friday" }),
      ),
    ).toBe(
      "https://example.com/pricing?a=1&b=2&utm_source=newsletter&utm_medium=email&utm_campaign=black_friday#plans",
    );
  });

  it("encodes spaces as %20 and reserved characters inside values", () => {
    expect(buildTaggedUrl("https://example.com", tags({ source: " a & b=c#d " }), false)).toBe(
      "https://example.com/?utm_source=a%20%26%20b%3Dc%23d",
    );
  });

  it("skips empty optional fields", () => {
    expect(buildTaggedUrl("https://example.com/x", tags({ source: "ig", content: "  " }))).toBe(
      "https://example.com/x?utm_source=ig",
    );
  });

  it("adds https to scheme-less input and rejects invalid input", () => {
    expect(buildTaggedUrl("example.com", tags({ source: "ig" }))).toBe(
      "https://example.com/?utm_source=ig",
    );
    expect(buildTaggedUrl("not a url", tags({ source: "ig" }))).toBeNull();
  });
});

describe("readUtmParams", () => {
  it("reads all six tags and ignores other params", () => {
    expect(
      readUtmParams(
        "https://example.com/?ref=x&utm_source=fb&utm_medium=paid&utm_campaign=c&utm_content=d&utm_term=e&utm_id=7",
      ),
    ).toEqual({ source: "fb", medium: "paid", campaign: "c", content: "d", term: "e", id: "7" });
  });

  it("returns nothing for a URL without tags", () => {
    expect(readUtmParams("https://example.com/?ref=x")).toEqual({});
  });
});

describe("cleanUtmValue", () => {
  it("lowercases, trims and joins words with single underscores", () => {
    expect(cleanUtmValue("  Spring Sale  2026 ")).toBe("spring_sale_2026");
    expect(cleanUtmValue("a__b")).toBe("a_b");
  });
});

describe("buildBulk", () => {
  it("skips blank lines and reports invalid ones by 1-based line number", () => {
    const result = buildBulk("example.com/a\n\nnope\r\n  \nexample.com/b", tags({ source: "x" }));
    expect(result).toEqual({
      ok: true,
      links: [
        { url: "https://example.com/a?utm_source=x", original: "example.com/a" },
        { url: "https://example.com/b?utm_source=x", original: "example.com/b" },
      ],
      invalidLines: [3],
    });
  });

  it("refuses more than the limit", () => {
    const text = Array.from({ length: MAX_BULK_URLS + 1 }, (_, i) => `example.com/${i}`).join("\n");
    expect(buildBulk(text, tags({ source: "x" }))).toEqual({
      ok: false,
      error: "Paste up to 1,000 URLs at a time.",
    });
    expect(buildBulk(`${text.split("\n").slice(1).join("\n")}\n\n`, tags({})).ok).toBe(true);
  });
});

describe("toCsv", () => {
  it("writes the url,note header and quotes per RFC 4180", () => {
    expect(
      toCsv([
        { url: "https://a.example/?utm_source=x", original: "a.example" },
        { url: "https://b.example/?q=1,2", original: 'say "hi"\nthere' },
      ]),
    ).toBe(
      'url,note\r\nhttps://a.example/?utm_source=x,a.example\r\n"https://b.example/?q=1,2","say ""hi""\nthere"',
    );
  });
});

describe("getShortenHref", () => {
  const output = "https://example.com/p?ref=x&utm_source=a%20b#top";

  it("sends signed-out visitors through sign-up with the URL encoded once", () => {
    const href = getShortenHref(output, false);
    expect(href.startsWith("/auth/sign-up?url=")).toBe(true);
    const params = new URL(href, "https://ishortn.ink").searchParams;
    expect(params.get("url")).toBe(output);
    expect(params.get("utm_source")).toBe("ishortn");
    expect(params.get("utm_medium")).toBe("tool");
    expect(params.get("utm_campaign")).toBe("utm-builder");
  });

  it("sends signed-in users straight to the link editor", () => {
    const href = getShortenHref(output, true);
    expect(href.startsWith("/dashboard/link/new?url=")).toBe(true);
    expect(new URL(href, "https://ishortn.ink").searchParams.get("url")).toBe(output);
  });

  it("falls back to plain destinations without output", () => {
    expect(getShortenHref(null, false)).toBe(
      "/auth/sign-up?utm_source=ishortn&utm_medium=tool&utm_campaign=utm-builder",
    );
    expect(getShortenHref(null, null)).toBe(getShortenHref(null, false));
    expect(getShortenHref(null, true)).toBe("/dashboard/link/new");
  });
});
