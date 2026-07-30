import { describe, expect, test } from "bun:test";

import { isBlockedAddress, isPublicHttpUrl } from "./ssrf";

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
      "http://224.0.0.1/", // multicast
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
