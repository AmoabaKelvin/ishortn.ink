import { describe, expect, test } from "bun:test";

import {
  baseDomain,
  formatReferrerLabel,
  groupReferrers,
  isSearchReferrer,
  isSocialReferrer,
} from "./referrer";
import { parseReferrer } from "./visitor";

describe("baseDomain", () => {
  test("keeps three labels under two-part country suffixes", () => {
    expect(baseDomain("google.co.uk")).toBe("google.co.uk");
    expect(baseDomain("news.google.co.uk")).toBe("google.co.uk");
    expect(baseDomain("www.abc.com.au")).toBe("abc.com.au");
  });

  test("keeps two labels otherwise", () => {
    expect(baseDomain("news.ycombinator.com")).toBe("ycombinator.com");
    expect(baseDomain("bit.ly")).toBe("bit.ly");
    expect(baseDomain("blog.example.de")).toBe("example.de");
  });

  test("parseReferrer stores the registrable domain", () => {
    expect(parseReferrer("https://www.google.co.uk/search?q=x")).toBe("google.co.uk");
    expect(parseReferrer("https://t.co/abc")).toBe("twitter");
    expect(parseReferrer(null)).toBe("direct");
  });
});

describe("referrer classification", () => {
  test("stored source labels count as social", () => {
    for (const label of ["twitter", "facebook", "linkedin", "reddit", "x.com", "instagram.com"]) {
      expect(isSocialReferrer(label)).toBe(true);
    }
    expect(isSocialReferrer("direct")).toBe(false);
    expect(isSocialReferrer("google.com")).toBe(false);
  });

  test("search engines match across country domains", () => {
    expect(isSearchReferrer("google.com")).toBe(true);
    expect(isSearchReferrer("google.co.uk")).toBe(true);
    expect(isSearchReferrer("duckduckgo.com")).toBe(true);
    expect(isSearchReferrer("twitter")).toBe(false);
  });

  test("labels are title-cased; domains stay as stored", () => {
    expect(formatReferrerLabel("direct")).toBe("Direct");
    expect(formatReferrerLabel("null")).toBe("Direct");
    expect(formatReferrerLabel("linkedin")).toBe("LinkedIn");
    expect(formatReferrerLabel("twitter")).toBe("Twitter");
    expect(formatReferrerLabel("google.co.uk")).toBe("google.co.uk");
    expect(formatReferrerLabel("https://www.example.com/page")).toBe("example.com");
  });

  test("groupReferrers merges legacy null with direct", () => {
    expect(groupReferrers({ null: 2, direct: 3, twitter: 1 })).toEqual([
      { source: "direct", name: "Direct", clicks: 5 },
      { source: "twitter", name: "Twitter", clicks: 1 },
    ]);
  });
});
