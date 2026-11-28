import { describe, expect, it } from "bun:test";

import { checkHttpUrl } from "@/server/lib/ssrf";

import { EXPAND_ERRORS, EXPANDER_USER_AGENT, MAX_REDIRECTS, expandUrl } from "./expand";

import type { ExpandDeps, OwnLinkOutcome } from "./expand";
import type { SafeBrowsingResult } from "@/server/lib/phishing/google-safe-browsing";

type Route = {
  status: number;
  location?: string;
  headers?: Record<string, string>;
  body?: string;
  /** What a HEAD request gets instead, for servers that answer HEAD differently. */
  head?: Route;
};
type Call = { url: string; method: string; userAgent: string | null };

// Public test hosts resolve to a public address; internal.example to a private one.
const DNS = new Map(
  Object.entries({
    "bit.ly": ["67.199.248.10"],
    "example.com": ["93.184.215.14"],
    "www.example.com": ["93.184.215.14"],
    "loop.example": ["93.184.215.15"],
    "slow.example": ["93.184.215.16"],
    "nohead.example": ["93.184.215.17"],
    "internal.example": ["10.0.0.5"],
  }),
);

function setup({
  routes = {},
  own = {},
  safety = { status: "safe" },
  hopTimeoutMs,
  fetchOverride,
}: {
  routes?: Record<string, Route>;
  own?: Record<string, OwnLinkOutcome>;
  safety?: SafeBrowsingResult;
  hopTimeoutMs?: number;
  fetchOverride?: ExpandDeps["fetch"];
}) {
  const calls: Call[] = [];
  const deps: ExpandDeps = {
    fetch:
      fetchOverride ??
      (async (url, init) => {
        const method = init.method ?? "GET";
        calls.push({ url, method, userAgent: new Headers(init.headers).get("user-agent") });
        expect(init.redirect).toBe("manual");
        const entry = routes[url];
        if (!entry) throw new Error(`unexpected fetch ${url}`);
        const route = method === "HEAD" ? (entry.head ?? entry) : entry;
        const headers = new Headers(route.headers);
        if (route.location) headers.set("location", route.location);
        return new Response(method === "HEAD" ? null : (route.body ?? null), {
          status: route.status,
          headers,
        });
      }),
    checkUrl: (url) => checkHttpUrl(url, async (host) => DNS.get(host) ?? []),
    resolveOwnLink: async (url) => own[url.toString()] ?? null,
    checkSafety: async () => safety,
    hopTimeoutMs,
  };
  return { deps, calls };
}

describe("expandUrl", () => {
  it("lists every hop and the final URL of a bit.ly style link", async () => {
    const { deps, calls } = setup({
      routes: {
        "https://bit.ly/3abc": { status: 301, location: "https://example.com/promo" },
        "https://example.com/promo": { status: 302, location: "/landing?ref=x" },
        "https://example.com/landing?ref=x": { status: 200 },
      },
    });

    const result = await expandUrl("bit.ly/3abc", deps);

    expect(result).toEqual({
      ok: true,
      hops: [
        { url: "https://bit.ly/3abc", status: 301 },
        { url: "https://example.com/promo", status: 302 },
        { url: "https://example.com/landing?ref=x", status: 200 },
      ],
      finalUrl: "https://example.com/landing?ref=x",
      note: null,
      mayRedirectAgain: false,
      safety: { status: "safe" },
    });
    expect(calls.every((call) => call.method === "HEAD")).toBe(true);
    expect(calls.every((call) => call.userAgent === EXPANDER_USER_AGENT)).toBe(true);
  });

  it("falls back to GET when a server rejects HEAD", async () => {
    const { deps, calls } = setup({
      routes: {
        "https://nohead.example/x": {
          status: 301,
          location: "https://example.com/",
          body: "moved",
          head: { status: 405 },
        },
        "https://example.com/": { status: 200 },
      },
    });

    const result = await expandUrl("https://nohead.example/x", deps);

    expect(result.ok && result.hops.map((hop) => hop.status)).toEqual([301, 200]);
    expect(calls.map((call) => call.method)).toEqual(["HEAD", "GET", "HEAD"]);
  });

  it("refuses private addresses on the first hop", async () => {
    for (const url of [
      "http://127.0.0.1",
      "http://169.254.169.254/latest/meta-data",
      "http://internal.example/",
    ]) {
      const { deps, calls } = setup({});
      expect(await expandUrl(url, deps)).toEqual({ ok: false, error: EXPAND_ERRORS.private });
      expect(calls).toHaveLength(0);
    }
  });

  it("refuses a redirect into a private network", async () => {
    for (const target of [
      "http://127.0.0.1/admin",
      "http://169.254.169.254/",
      "http://internal.example/",
    ]) {
      const { deps, calls } = setup({
        routes: { "https://bit.ly/x": { status: 302, location: target } },
      });
      expect(await expandUrl("https://bit.ly/x", deps)).toEqual({
        ok: false,
        error: EXPAND_ERRORS.private,
      });
      expect(calls.map((call) => call.url)).toEqual(["https://bit.ly/x"]);
    }
  });

  it(`follows ${MAX_REDIRECTS} redirects and stops at the next one`, async () => {
    const chain = (length: number) =>
      Object.fromEntries(
        Array.from({ length: length + 1 }, (_, i): [string, Route] => [
          `https://loop.example/${i}`,
          i < length ? { status: 302, location: `https://loop.example/${i + 1}` } : { status: 200 },
        ]),
      );

    const ten = await expandUrl("https://loop.example/0", setup({ routes: chain(10) }).deps);
    expect(ten.ok && ten.hops).toHaveLength(11);

    const eleven = await expandUrl("https://loop.example/0", setup({ routes: chain(11) }).deps);
    expect(eleven).toEqual({ ok: false, error: EXPAND_ERRORS.tooManyRedirects });
  });

  it("gives up on a hop after the timeout", async () => {
    const { deps } = setup({
      hopTimeoutMs: 20,
      fetchOverride: (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    });
    expect(await expandUrl("https://slow.example/", deps)).toEqual({
      ok: false,
      error: EXPAND_ERRORS.timeout,
    });
  });

  it("rejects input that isn't a web address", async () => {
    const { deps } = setup({});
    for (const input of ["", "not a link", "ftp://example.com/file", "javascript:alert(1)"]) {
      expect(await expandUrl(input, deps)).toEqual({ ok: false, error: EXPAND_ERRORS.notAUrl });
    }
  });

  it("stops at a redirect to an app link", async () => {
    const { deps } = setup({
      routes: { "https://bit.ly/app": { status: 302, location: "itms-apps://apps.apple.com/x" } },
    });
    expect(await expandUrl("https://bit.ly/app", deps)).toEqual({
      ok: false,
      error: EXPAND_ERRORS.appLink,
    });
  });

  it("resolves our own links from the database without an HTTP request", async () => {
    const { deps, calls } = setup({
      own: {
        "https://isht.app/spring": { type: "redirect", location: "https://example.com/sale" },
      },
      routes: { "https://example.com/sale": { status: 200 } },
    });

    const result = await expandUrl("isht.app/spring", deps);

    expect(result.ok && result.hops).toEqual([
      { url: "https://isht.app/spring", status: 307, ishortn: true },
      { url: "https://example.com/sale", status: 200 },
    ]);
    expect(calls.map((call) => call.url)).toEqual(["https://example.com/sale"]);
  });

  it("stops at a blocked or protected iShortn link and explains why", async () => {
    const note = "This link was flagged as unsafe and has been disabled.";
    const { deps, calls } = setup({
      own: { "https://ishortn.ink/bad": { type: "stop", status: 403, note } },
    });
    const result = await expandUrl("https://ishortn.ink/bad", deps);
    expect(result.ok && [result.finalUrl, result.note]).toEqual(["https://ishortn.ink/bad", note]);
    expect(calls).toHaveLength(0);
  });

  it("reports an iShortn address with no link", async () => {
    const { deps } = setup({ own: { "https://ishortn.ink/nothing": { type: "missing" } } });
    expect(await expandUrl("https://ishortn.ink/nothing", deps)).toEqual({
      ok: false,
      error: EXPAND_ERRORS.missingOwnLink,
    });
  });

  it("warns when the final page has a meta refresh", async () => {
    const { deps } = setup({
      routes: {
        // HEAD responses carry no body, so the page is fetched again with GET to look for it.
        "https://example.com/": {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
          body: '<html><head><meta http-equiv="refresh" content="0;url=https://elsewhere.example"></head></html>',
        },
      },
    });
    const result = await expandUrl("https://example.com/", deps);
    expect(result.ok && result.mayRedirectAgain).toBe(true);
  });

  it("does not warn for an ordinary HTML page", async () => {
    const { deps } = setup({
      routes: {
        "https://example.com/": {
          status: 200,
          headers: { "content-type": "text/html" },
          body: "<html><head><title>Hi</title></head></html>",
        },
      },
    });
    const result = await expandUrl("https://example.com/", deps);
    expect(result.ok && result.mayRedirectAgain).toBe(false);
  });

  it("reports a Safe Browsing match in plain words", async () => {
    const { deps } = setup({
      routes: { "https://example.com/": { status: 200 } },
      safety: { status: "unsafe", threats: ["SOCIAL_ENGINEERING", "MALWARE", "MALWARE"] },
    });
    const result = await expandUrl("https://example.com/", deps);
    expect(result.ok && result.safety).toEqual({
      status: "unsafe",
      threats: ["phishing", "malware"],
    });
  });

  it("says the check is unavailable when Safe Browsing fails", async () => {
    const { deps } = setup({
      routes: { "https://example.com/": { status: 200 } },
      safety: { status: "error" },
    });
    const result = await expandUrl("https://example.com/", deps);
    expect(result.ok && result.safety).toEqual({ status: "unknown" });
  });
});
