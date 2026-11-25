import { describe, expect, test } from "bun:test";

import { decodeEntities, decodeHtml, detectCharset } from "./metadata";

const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));

// "تقييم الخدمة" in windows-1256.
const ARABIC_TITLE_1256 = [0xca, 0xde, 0xed, 0xed, 0xe3, 0x20, 0xc7, 0xe1, 0xce, 0xcf, 0xe3, 0xc9];

function page(head: string, title: number[]): Uint8Array {
  return new Uint8Array([
    ...ascii(`<html><head>${head}<title>`),
    ...title,
    ...ascii("</title></head><body></body></html>"),
  ]);
}

const titleOf = (html: string) => html.match(/<title>([^<]*)<\/title>/)?.[1];

describe("decodeHtml", () => {
  test("decodes windows-1256 declared only in the Content-Type header", () => {
    const bytes = page("", ARABIC_TITLE_1256);
    expect(titleOf(decodeHtml(bytes, "text/html; charset=windows-1256"))).toBe("تقييم الخدمة");
  });

  test("decodes windows-1256 declared only in <meta charset>", () => {
    const bytes = page('<meta charset="windows-1256">', ARABIC_TITLE_1256);
    expect(titleOf(decodeHtml(bytes, "text/html"))).toBe("تقييم الخدمة");
  });

  test("decodes windows-1256 declared only in <meta http-equiv>", () => {
    const bytes = page(
      '<meta http-equiv="Content-Type" content="text/html; charset=windows-1256">',
      ARABIC_TITLE_1256,
    );
    expect(titleOf(decodeHtml(bytes, "text/html"))).toBe("تقييم الخدمة");
  });

  test("decodes UTF-8 when no charset is declared anywhere", () => {
    const bytes = page("", Array.from(new TextEncoder().encode("Привет, мир ✓")));
    expect(titleOf(decodeHtml(bytes, "text/html"))).toBe("Привет, мир ✓");
  });
});

describe("detectCharset", () => {
  test("prefers the header over a <meta> tag", () => {
    const bytes = page('<meta charset="windows-1251">', []);
    expect(detectCharset(bytes, "text/html; charset=windows-1256")).toBe("windows-1256");
  });

  test("uses the BOM when the header has no charset", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...page('<meta charset="windows-1251">', [])]);
    expect(detectCharset(bytes, "text/html")).toBe("utf-8");
  });

  test("ignores <meta> tags past the first 1024 bytes", () => {
    const bytes = page(`${" ".repeat(1100)}<meta charset="windows-1256">`, []);
    expect(detectCharset(bytes, "text/html")).toBe("utf-8");
  });

  test("falls back to UTF-8 for an unsupported label", () => {
    expect(detectCharset(page("", []), "text/html; charset=not-a-charset")).toBe("utf-8");
  });
});

describe("decodeEntities", () => {
  test("decodes decimal and hex numeric references", () => {
    expect(decodeEntities("&#1578;&#x642;")).toBe("تق");
  });

  test("decodes named entities once", () => {
    expect(decodeEntities("Tom &amp; Jerry &#39;&quot;&lt;&amp;lt;")).toBe(`Tom & Jerry '"<&lt;`);
  });

  test("replaces invalid code points", () => {
    expect(decodeEntities("&#0;&#xD800;&#x110000;")).toBe("���");
  });
});
