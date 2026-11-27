import { describe, expect, test } from "bun:test";

import { describeLinkHealth } from "@/lib/link-health";

import {
  checkDestination,
  classifyFetchError,
  classifyStatus,
  createCheckResolver,
  DnsLookupFailed,
  LINK_CHECK_USER_AGENT,
} from "./check";

const PUBLIC_IP = "93.184.216.34";
const resolve = async (hostname: string) => (hostname === "gone.invalid" ? [] : [PUBLIC_IP]);

type Route = (init: RequestInit) => Response | Promise<Response>;

function fakeFetch(routes: Record<string, Route>) {
  const calls: Array<{ url: string; method: string; userAgent: string | null }> = [];
  // SAFETY: the fake takes the (url, init) calls checkDestination makes; nothing else calls it.
  const impl = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({
      url,
      method: init.method ?? "GET",
      userAgent: new Headers(init.headers).get("user-agent"),
    });
    const route = routes[url];
    if (!route) throw new Error(`unexpected fetch ${url}`);
    return route(init);
  }) as typeof fetch;
  return { impl, calls };
}

const status = (code: number, headers?: Record<string, string>) => () =>
  new Response(null, { status: code, headers });

describe("checkDestination", () => {
  test("200 is ok, with a HEAD request and the iShortn user agent", async () => {
    const { impl, calls } = fakeFetch({ "https://ok.test/": status(200) });
    expect(await checkDestination("https://ok.test/", { fetch: impl, resolve })).toEqual({
      kind: "ok",
      status: 200,
    });
    expect(calls).toEqual([
      { url: "https://ok.test/", method: "HEAD", userAgent: LINK_CHECK_USER_AGENT },
    ]);
  });

  test("404, 410 and 5xx are failures", async () => {
    for (const code of [404, 410, 500, 503]) {
      const { impl } = fakeFetch({ "https://x.test/": status(code) });
      expect(await checkDestination("https://x.test/", { fetch: impl, resolve })).toEqual({
        kind: "failure",
        status: code,
        error: null,
      });
    }
  });

  test("401, 403, 429 and bot challenges are inconclusive", async () => {
    for (const route of [status(401), status(403), status(429)]) {
      const { impl } = fakeFetch({ "https://x.test/": route });
      expect(await checkDestination("https://x.test/", { fetch: impl, resolve })).toEqual({
        kind: "inconclusive",
      });
    }
    const { impl } = fakeFetch({ "https://x.test/": status(503, { "cf-mitigated": "challenge" }) });
    expect((await checkDestination("https://x.test/", { fetch: impl, resolve })).kind).toBe(
      "inconclusive",
    );
  });

  test("falls back to GET when HEAD is refused", async () => {
    const { impl, calls } = fakeFetch({
      "https://x.test/": (init) =>
        new Response(null, { status: init.method === "HEAD" ? 405 : 200 }),
    });
    expect(await checkDestination("https://x.test/", { fetch: impl, resolve })).toEqual({
      kind: "ok",
      status: 200,
    });
    expect(calls.map((call) => call.method)).toEqual(["HEAD", "GET"]);
  });

  test("follows redirects and judges the final page", async () => {
    const { impl } = fakeFetch({
      "http://x.test/a": status(301, { location: "https://x.test/b" }),
      "https://x.test/b": status(302, { location: "/c" }),
      "https://x.test/c": status(404),
    });
    expect(await checkDestination("http://x.test/a", { fetch: impl, resolve })).toEqual({
      kind: "failure",
      status: 404,
      error: null,
    });
  });

  test("more than 5 redirects is a failure", async () => {
    const { impl, calls } = fakeFetch({
      "https://x.test/loop": status(302, { location: "https://x.test/loop" }),
    });
    expect(await checkDestination("https://x.test/loop", { fetch: impl, resolve })).toEqual({
      kind: "failure",
      status: null,
      error: "too_many_redirects",
    });
    expect(calls).toHaveLength(6);
  });

  test("an unresolvable host is a DNS failure, without a fetch", async () => {
    const { impl, calls } = fakeFetch({});
    expect(await checkDestination("https://gone.invalid/", { fetch: impl, resolve })).toEqual({
      kind: "failure",
      status: null,
      error: "dns_failure",
    });
    expect(calls).toHaveLength(0);
  });

  test("a failed DNS lookup is inconclusive, without a fetch", async () => {
    const { impl, calls } = fakeFetch({});
    const failing = async () => {
      throw new DnsLookupFailed("lookup failed");
    };
    expect(await checkDestination("https://x.test/", { fetch: impl, resolve: failing })).toEqual({
      kind: "inconclusive",
    });
    expect(calls).toHaveLength(0);
  });

  test("private addresses are never fetched", async () => {
    const { impl, calls } = fakeFetch({});
    const check = await checkDestination("http://127.0.0.1/admin", { fetch: impl, resolve });
    expect(check).toEqual({ kind: "inconclusive" });
    expect(calls).toHaveLength(0);
  });

  test("timeouts and connection errors are failures", async () => {
    const timeout = fakeFetch({
      "https://slow.test/": (init) =>
        new Promise((_, reject) =>
          init.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
        ),
    });
    expect(
      await checkDestination("https://slow.test/", { fetch: timeout.impl, resolve, timeoutMs: 20 }),
    ).toEqual({ kind: "failure", status: null, error: "timeout" });

    const refused = fakeFetch({
      "https://down.test/": () => {
        throw new TypeError("fetch failed", {
          cause: Object.assign(new Error("connect failed"), { code: "ECONNREFUSED" }),
        });
      },
    });
    expect(await checkDestination("https://down.test/", { fetch: refused.impl, resolve })).toEqual({
      kind: "failure",
      status: null,
      error: "connection_failed",
    });
  });
});

describe("classifyStatus", () => {
  // Response can't be built with a status outside 200-599, but servers send them.
  test("non-standard codes such as LinkedIn's 999 are inconclusive", () => {
    expect(classifyStatus(999, new Headers())).toEqual({ kind: "inconclusive" });
  });
});

describe("classifyFetchError", () => {
  test("recognises DNS and TLS errors", () => {
    expect(
      classifyFetchError(
        new TypeError("x", {
          cause: Object.assign(new Error("lookup failed"), { code: "ENOTFOUND" }),
        }),
      ),
    ).toBe("dns_failure");
    expect(
      classifyFetchError(new TypeError("x", { cause: new Error("certificate has expired") })),
    ).toBe("tls_error");
  });
});

describe("describeLinkHealth", () => {
  test("labels statuses and errors", () => {
    expect(describeLinkHealth(404, null)).toBe("404 Not Found");
    expect(describeLinkHealth(522, null)).toBe("522 Server error");
    expect(describeLinkHealth(null, "dns_failure")).toBe("DNS lookup failed");
    expect(describeLinkHealth(null, null)).toBe("Unreachable");
  });
});

describe("createCheckResolver", () => {
  const dnsError = (code: string) => Object.assign(new Error(`queryA ${code} x.test`), { code });
  type Lookup = (hostname: string) => Promise<string[]>;
  const found =
    (addresses: string[]): Lookup =>
    async () =>
      addresses;
  const fails =
    (code: string): Lookup =>
    async () => {
      throw dnsError(code);
    };
  const resolver = (resolve4: Lookup, resolve6: Lookup) =>
    createCheckResolver({ resolve4, resolve6 });

  test("returns the addresses any lookup found", async () => {
    expect(await resolver(found([PUBLIC_IP]), fails("ETIMEOUT"))("x.test")).toEqual([PUBLIC_IP]);
    expect(await resolver(fails("ENODATA"), found(["2606:2800::1"]))("x.test")).toEqual([
      "2606:2800::1",
    ]);
  });

  test("NXDOMAIN and no records mean the name has no address", async () => {
    expect(await resolver(fails("ENOTFOUND"), fails("ENOTFOUND"))("x.test")).toEqual([]);
    expect(await resolver(fails("ENODATA"), fails("ENOTFOUND"))("x.test")).toEqual([]);
    expect(await resolver(found([]), fails("ENODATA"))("x.test")).toEqual([]);
  });

  for (const code of ["ETIMEOUT", "ESERVFAIL", "ECONNREFUSED", "EBADRESP", "EBADQUERY"]) {
    test(`${code} from the resolver throws instead of reading as a missing name`, async () => {
      await expect(resolver(fails("ENOTFOUND"), fails(code))("x.test")).rejects.toBeInstanceOf(
        DnsLookupFailed,
      );
      await expect(resolver(fails(code), fails(code))("x.test")).rejects.toBeInstanceOf(
        DnsLookupFailed,
      );
    });
  }

  test("an error without a code throws", async () => {
    const lookup = async () => {
      throw new Error("network down");
    };
    await expect(
      createCheckResolver({ resolve4: lookup, resolve6: lookup })("x.test"),
    ).rejects.toThrow(DnsLookupFailed);
  });
});
