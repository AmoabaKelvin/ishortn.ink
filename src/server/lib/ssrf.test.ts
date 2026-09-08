import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

// Resolver is stubbed for the whole file so no test touches the network.
// Default: every name fails to resolve; tests that need records override it.
const resolve4 = mock(async (_hostname: string): Promise<string[]> => {
  throw new Error("ENOTFOUND");
});
const resolve6 = mock(async (_hostname: string): Promise<string[]> => {
  throw new Error("ENODATA");
});
mock.module("node:dns/promises", () => ({ resolve4, resolve6 }));

const { isBlockedAddress, isPublicHttpUrl, safeFetch } = await import("./ssrf");

function resolveTo(...addresses: string[]) {
  resolve4.mockResolvedValue(addresses.filter((a) => !a.includes(":")));
  resolve6.mockResolvedValue(addresses.filter((a) => a.includes(":")));
}
function resetResolver() {
  resolve4.mockReset();
  resolve6.mockReset();
  resolve4.mockRejectedValue(new Error("ENOTFOUND"));
  resolve6.mockRejectedValue(new Error("ENODATA"));
}

// A resolver returns an address as text, and an IPv4-mapped address has two
// valid textual forms. Both must classify the same way — the dotted form is
// what getaddrinfo emits, and it previously slipped through.
describe("isBlockedAddress", () => {
  test("blocks both textual forms of an IPv4-mapped address", () => {
    for (const address of [
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
      "::ffff:169.254.169.254",
      "::ffff:a9fe:a9fe",
      "::ffff:10.0.0.5",
      "::ffff:a00:5",
      "::ffff:192.168.1.1",
    ]) {
      expect([address, isBlockedAddress(address)]).toEqual([address, true]);
    }
  });

  test("allows an IPv4-mapped public address in both forms", () => {
    for (const address of ["::ffff:1.1.1.1", "::ffff:101:101"]) {
      expect([address, isBlockedAddress(address)]).toEqual([address, false]);
    }
  });

  test("ignores a zone index and refuses anything that is not an IP", () => {
    expect(isBlockedAddress("fe80::1%en0")).toBe(true);
    expect(isBlockedAddress("not-an-ip")).toBe(true);
    expect(isBlockedAddress("")).toBe(true);
  });
});

// IP literals only, so the assertions never touch a resolver.
describe("isPublicHttpUrl", () => {
  test("refuses non-http schemes and malformed input", async () => {
    for (const url of ["file:///etc/passwd", "gopher://1.1.1.1/", "data:text/plain,x", "nope"]) {
      expect([url, await isPublicHttpUrl(url)]).toEqual([url, false]);
    }
  });

  test("refuses reserved IPv4 destinations", async () => {
    for (const url of [
      "http://169.254.169.254/latest/meta-data/", // cloud metadata
      "http://127.0.0.1:3000/",
      "http://0.0.0.0/",
      "http://10.0.0.5/",
      "http://172.16.4.4/",
      "http://192.168.1.1/",
      "http://100.64.0.1/", // CGNAT
      "http://198.18.0.1/", // benchmarking
      "http://192.0.2.1/", // TEST-NET-1
      "http://198.51.100.1/", // TEST-NET-2
      "http://203.0.113.1/", // TEST-NET-3
      "http://224.0.0.1/", // multicast
      "http://240.0.0.1/", // reserved
      "http://255.255.255.255/", // broadcast
    ]) {
      expect([url, await isPublicHttpUrl(url)]).toEqual([url, false]);
    }
  });

  test("refuses reserved IPv6 destinations, including IPv4-mapped forms", async () => {
    for (const url of [
      "http://[::1]/",
      "http://[::]/",
      "http://[fd00::1]/", // unique-local
      "http://[fe80::1]/", // link-local
      "http://[ff02::1]/", // multicast
      "http://[::ffff:127.0.0.1]/", // IPv4-mapped loopback
      "http://[::ffff:10.0.0.5]/", // IPv4-mapped private
      "http://[::a00:5]/", // IPv4-compatible private
      "http://[64:ff9b::7f00:1]/", // NAT64 wrapping loopback
      "http://[2002:c0a8:101::1]/", // 6to4
      "http://[2001:0:c0a8::1]/", // Teredo
      "http://[2001:2::1]/", // benchmarking
      "http://[2001:db8::1]/", // documentation
      "http://[3fff::1]/", // documentation
    ]) {
      expect([url, await isPublicHttpUrl(url)]).toEqual([url, false]);
    }
  });

  test("allows public unicast destinations", async () => {
    for (const url of ["http://1.1.1.1/", "https://[2606:4700:4700::1111]/"]) {
      expect([url, await isPublicHttpUrl(url)]).toEqual([url, true]);
    }
  });
});

describe("isPublicHttpUrl with a resolver", () => {
  afterEach(resetResolver);

  test("allows a name that resolves only to public addresses", async () => {
    resolveTo("1.1.1.1", "2606:4700:4700::1111");
    expect(await isPublicHttpUrl("https://example.com/")).toBe(true);
  });

  test("allows a name with only an A record", async () => {
    resolve4.mockResolvedValue(["1.1.1.1"]);
    expect(await isPublicHttpUrl("https://example.com/")).toBe(true);
  });

  test("refuses a name with any private record among public ones", async () => {
    resolveTo("1.1.1.1", "10.0.0.5");
    expect(await isPublicHttpUrl("https://example.com/")).toBe(false);
  });

  test("refuses a name whose AAAA record is private even when A is public", async () => {
    resolveTo("1.1.1.1", "::ffff:169.254.169.254");
    expect(await isPublicHttpUrl("https://example.com/")).toBe(false);
  });

  test("refuses a name that fails to resolve or has no records", async () => {
    expect(await isPublicHttpUrl("https://example.com/")).toBe(false);
    resolveTo();
    expect(await isPublicHttpUrl("https://example.com/")).toBe(false);
  });
});

describe("safeFetch", () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  let responses: Record<string, Response>;

  beforeEach(() => {
    calls.length = 0;
    responses = {};
    resolveTo("1.1.1.1");
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      return responses[url] ?? new Response("ok", { status: 200 });
    });
  });
  afterEach(resetResolver);
  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  const redirect = (status: number, location: string) =>
    new Response(null, { status, headers: { location } });

  test("refuses a private destination without fetching", async () => {
    expect(await safeFetch("http://127.0.0.1/")).toBeNull();
    expect(calls).toEqual([]);
  });

  test("follows a public redirect and returns the final response", async () => {
    responses["https://a.example/"] = redirect(302, "https://b.example/");
    responses["https://b.example/"] = new Response("final", { status: 200 });
    const res = await safeFetch("https://a.example/");
    expect(await res?.text()).toBe("final");
    expect(calls).toEqual(["https://a.example/", "https://b.example/"]);
  });

  test("refuses a redirect to a private address", async () => {
    responses["https://a.example/"] = redirect(301, "http://169.254.169.254/latest/meta-data/");
    expect(await safeFetch("https://a.example/")).toBeNull();
    expect(calls).toEqual(["https://a.example/"]);
  });

  test("refuses a redirect to a non-http scheme", async () => {
    responses["https://a.example/"] = redirect(307, "file:///etc/passwd");
    expect(await safeFetch("https://a.example/")).toBeNull();
    expect(calls).toEqual(["https://a.example/"]);
  });

  test("gives up after the redirect limit", async () => {
    responses["https://a.example/"] = redirect(302, "https://a.example/");
    expect(await safeFetch("https://a.example/", { maxRedirects: 2 })).toBeNull();
    expect(calls).toHaveLength(3);
  });

  test("returns non-redirect 3xx responses as-is", async () => {
    responses["https://a.example/"] = new Response(null, {
      status: 304,
      headers: { location: "http://127.0.0.1/" },
    });
    const res = await safeFetch("https://a.example/");
    expect(res?.status).toBe(304);
    expect(calls).toEqual(["https://a.example/"]);
  });
});
