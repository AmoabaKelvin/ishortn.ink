import { describe, expect, test } from "bun:test";

import { INVALID_URL_REASON, runHeuristicChecks } from "./heuristics";

describe("runHeuristicChecks subdomain depth", () => {
  test.each([
    "http://6a739eb5739326d9d883-09ee10949a722f427c3e0d223e137eca.r94.cf2.rackcdn.com/Armstrong%20Equipment%20Warranty%20Options%202026.pdf",
    "https://bucket.s3.us-east-1.amazonaws.com/file.pdf",
    "https://account.blob.core.windows.net/container/file.pdf",
    "https://www.shop.example.co.uk/",
    "https://a.b.c.example.com/",
  ])("allows %s", (url) => {
    expect(runHeuristicChecks(url)).toEqual({ blocked: false, reason: "" });
  });

  test("allows allowlisted storage hosts nested deeper than the limit", () => {
    expect(runHeuristicChecks("https://a.b.c.d.e.cloudfront.net/x.pdf").blocked).toBe(false);
    expect(runHeuristicChecks("https://a.b.c.d.storage.googleapis.com/x").blocked).toBe(false);
  });

  test("blocks deep nesting on an unknown domain", () => {
    expect(runHeuristicChecks("https://a.b.c.d.evil.com/login")).toEqual({
      blocked: true,
      reason: "URL has 4 subdomain levels, which is suspicious",
    });
    expect(runHeuristicChecks("https://a.b.c.d.evil.co.uk/").blocked).toBe(true);
  });

  test("does not treat lookalike suffixes as allowlisted", () => {
    expect(runHeuristicChecks("https://a.b.c.d.evilrackcdn.com/").blocked).toBe(true);
    expect(runHeuristicChecks("https://a.b.c.d.rackcdn.com.evil.com/").blocked).toBe(true);
  });
});

describe("runHeuristicChecks other rules", () => {
  test("blocks IP hosts, @ in the authority and suspicious TLDs", () => {
    expect(runHeuristicChecks("http://192.168.0.1/").blocked).toBe(true);
    expect(runHeuristicChecks("https://paypal.com@evil.com/").blocked).toBe(true);
    expect(runHeuristicChecks("https://free-stuff.tk/").blocked).toBe(true);
  });

  test("blocks homoglyph brand impersonation", () => {
    expect(runHeuristicChecks("https://paypa1.com/").blocked).toBe(true);
  });

  test("flags unparseable URLs as invalid", () => {
    expect(runHeuristicChecks("not a url")).toEqual({ blocked: true, reason: INVALID_URL_REASON });
  });
});
