import { describe, expect, it } from "bun:test";

import { QRCodeSVG } from "qrcode.react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  getQrSignupHref,
  MAX_QR_URL_LENGTH,
  parseQrUrl,
  qrUrlFromSearch,
  toSvgFile,
} from "./utils";

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

describe("qrUrlFromSearch", () => {
  it("decodes a URL-encoded value", () => {
    expect(qrUrlFromSearch("?url=https%3A%2F%2Fexample.com%2Fa%3Futm_source%3Dx")).toBe(
      "https://example.com/a?utm_source=x",
    );
  });

  it("normalises a bare domain like typed input", () => {
    expect(qrUrlFromSearch("?url=example.com/menu")).toBe("https://example.com/menu");
  });

  it("ignores a missing, empty or invalid value", () => {
    expect(qrUrlFromSearch("")).toBeNull();
    expect(qrUrlFromSearch("?utm_source=x")).toBeNull();
    expect(qrUrlFromSearch("?url=")).toBeNull();
    expect(qrUrlFromSearch("?url=javascript:alert(1)")).toBeNull();
    expect(qrUrlFromSearch("?url=javascript%3Aalert(1)")).toBeNull();
    expect(qrUrlFromSearch("?url=hello%20world")).toBeNull();
  });
});

describe("toSvgFile", () => {
  const markup = renderToStaticMarkup(
    createElement(QRCodeSVG, {
      value: "https://example.com",
      size: 1024,
      level: "M",
      includeMargin: true,
    }),
  );

  it("turns inline QR markup into a standalone SVG document", () => {
    const file = toSvgFile(markup);
    expect(
      file.startsWith(
        '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg"',
      ),
    ).toBe(true);
    // 25 modules for this URL at level M, plus the 4-module quiet zone on each side.
    expect(file).toContain('viewBox="0 0 33 33"');
    expect(file).not.toMatch(/href|url\(/);
  });

  it("keeps an existing namespace", () => {
    const withNamespace = markup.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    expect(toSvgFile(withNamespace).match(/xmlns=/g)).toHaveLength(1);
  });
});

describe("getQrSignupHref", () => {
  const url = "https://example.com/menu?table=4&lang=en#specials";

  it("sends signed-out visitors to sign-up with the tool's UTM params only", () => {
    const href = new URL(getQrSignupHref(url, false), "https://ishortn.ink");
    expect(href.pathname).toBe("/auth/sign-up");
    expect(href.hash).toBe("");
    expect(Object.fromEntries(href.searchParams)).toEqual({
      utm_source: "ishortn_site",
      utm_medium: "landing",
      utm_campaign: "qr-code-generator",
    });
    expect(getQrSignupHref(url, null)).toBe(href.pathname + href.search);
    expect(getQrSignupHref(null, false)).toBe(href.pathname + href.search);
  });

  it("opens the link editor with the URL, query string and fragment intact when signed in", () => {
    const href = new URL(getQrSignupHref(url, true), "https://ishortn.ink");
    expect(href.pathname).toBe("/dashboard/link/new");
    expect(href.hash).toBe("");
    expect([...href.searchParams.keys()]).toEqual(["url"]);
    expect(href.searchParams.get("url")).toBe(url);
  });

  it("opens an empty link editor when signed in without a URL", () => {
    expect(getQrSignupHref(null, true)).toBe("/dashboard/link/new");
  });
});
