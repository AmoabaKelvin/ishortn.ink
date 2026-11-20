import { describe, expect, it } from "bun:test";

import { MAX_QR_URL_LENGTH, parseQrUrl } from "./utils";

describe("parseQrUrl", () => {
  it("keeps a full https URL as typed", () => {
    expect(parseQrUrl("https://ishortn.ink/launch?ref=menu")).toEqual({
      ok: true,
      url: "https://ishortn.ink/launch?ref=menu",
    });
  });

  it("adds https to a bare domain and trims whitespace", () => {
    expect(parseQrUrl("  example.com/menu ")).toEqual({
      ok: true,
      url: "https://example.com/menu",
    });
  });

  it("treats a host with a port as a bare domain", () => {
    expect(parseQrUrl("example.com:8080/menu")).toEqual({
      ok: true,
      url: "https://example.com:8080/menu",
    });
  });

  it("accepts http URLs", () => {
    expect(parseQrUrl("http://example.com")).toEqual({ ok: true, url: "http://example.com" });
  });

  it("rejects empty input", () => {
    expect(parseQrUrl("   ").ok).toBe(false);
  });

  it("rejects text that is not a URL", () => {
    expect(parseQrUrl("hello world").ok).toBe(false);
    expect(parseQrUrl("hello").ok).toBe(false);
    expect(parseQrUrl("https://example.").ok).toBe(false);
  });

  it("rejects non-http schemes", () => {
    expect(parseQrUrl("javascript:alert(1)").ok).toBe(false);
    expect(parseQrUrl("ftp://example.com/file").ok).toBe(false);
  });

  it("rejects URLs too long to encode", () => {
    const long = `https://example.com/${"a".repeat(MAX_QR_URL_LENGTH)}`;
    expect(parseQrUrl(long).ok).toBe(false);
  });
});
