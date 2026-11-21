import { describe, expect, test } from "bun:test";

import { formatShortenIntentForDisplay } from "./shorten-intent-display";

describe("formatShortenIntentForDisplay", () => {
  test("shows hostname and path, without scheme, credentials, port, query or fragment", () => {
    expect(formatShortenIntentForDisplay("https://example.org/landing")).toBe(
      "example.org/landing",
    );
    expect(
      formatShortenIntentForDisplay(
        "http://user:secret@example.org:8080/p?utm_source=news&token=abc#top",
      ),
    ).toBe("example.org/p");
    expect(formatShortenIntentForDisplay("https://example.org/")).toBe("example.org");
  });

  test("accepts scheme-less input the way the link editor does", () => {
    expect(formatShortenIntentForDisplay("  example.org/landing  ")).toBe("example.org/landing");
  });

  test("truncates to 40 characters with an ellipsis", () => {
    const display = formatShortenIntentForDisplay(
      "https://example.org/landing/spring-sale-2026/campaign?utm_source=news",
    );
    expect(display).toBe("example.org/landing/spring-sale-2026/ca…");
    expect(Array.from(display ?? "")).toHaveLength(40);
    expect(formatShortenIntentForDisplay("https://example.org/abcdefghijklmnopqrstuvwxyz0")).toBe(
      "example.org/abcdefghijklmnopqrstuvwxyz0",
    );
  });

  test("truncates a very long hostname", () => {
    const host = `${"a".repeat(63)}.${"b".repeat(63)}.example.com`;
    expect(formatShortenIntentForDisplay(`https://${host}/path`)).toBe(`${"a".repeat(39)}…`);
  });

  test("shows IDN hostnames in Unicode, whichever form they arrive in", () => {
    expect(formatShortenIntentForDisplay("https://münchen.de/events")).toBe("münchen.de/events");
    expect(formatShortenIntentForDisplay("https://xn--mnchen-3ya.de/events")).toBe(
      "münchen.de/events",
    );
    expect(formatShortenIntentForDisplay("https://例え.テスト/")).toBe("例え.テスト");
  });

  test("never cuts a character in half", () => {
    const display = formatShortenIntentForDisplay(`https://例え.テスト/${"日本".repeat(30)}`);
    expect(display?.endsWith("…")).toBe(true);
    expect(Array.from(display ?? "")).toHaveLength(40);
  });

  test("rejects non-http(s) schemes", () => {
    for (const intent of [
      "javascript:alert(1)",
      "JavaScript:alert(document.cookie)",
      "data:text/html,<script>alert(1)</script>",
      "ftp://example.org/file",
      "mailto:someone@example.org",
    ]) {
      expect(formatShortenIntentForDisplay(intent)).toBeNull();
    }
  });

  test("rejects missing, empty and unparseable values", () => {
    for (const intent of [
      undefined,
      "",
      "   ",
      "not a url",
      "hello",
      "https://",
      "http://exa mple.org",
    ]) {
      expect(formatShortenIntentForDisplay(intent)).toBeNull();
    }
  });
});
