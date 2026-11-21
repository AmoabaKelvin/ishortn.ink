import { describe, expect, test } from "bun:test";

import { SHORTEN_INTENT_MAX_LENGTH, extractShortenIntent, getPostAuthUrl } from "./shorten-intent";

const tagged = "https://example.com/p?utm_source=news&utm_medium=email";

describe("extractShortenIntent", () => {
  test("moves url out of the sign-up URL and keeps the utm params", () => {
    const result = extractShortenIntent(
      new URL(
        `https://ishortn.ink/auth/sign-up?url=${encodeURIComponent(tagged)}&utm_source=ishortn&utm_medium=tool&utm_campaign=utm-builder`,
      ),
    );
    expect(result?.intent).toBe(tagged);
    expect(result?.cleanUrl.toString()).toBe(
      "https://ishortn.ink/auth/sign-up?utm_source=ishortn&utm_medium=tool&utm_campaign=utm-builder",
    );
  });

  test("covers sign-in and nested auth steps", () => {
    expect(extractShortenIntent(new URL("https://ishortn.ink/auth/sign-in?url=x"))?.intent).toBe(
      "x",
    );
    expect(
      extractShortenIntent(new URL("https://ishortn.ink/auth/sign-up/verify-email-address?url=x"))
        ?.cleanUrl.pathname,
    ).toBe("/auth/sign-up/verify-email-address");
  });

  test("ignores other paths and auth pages without url", () => {
    expect(extractShortenIntent(new URL("https://ishortn.ink/utm-builder?url=x"))).toBeNull();
    expect(extractShortenIntent(new URL("https://ishortn.ink/auth/sign-upx?url=x"))).toBeNull();
    expect(extractShortenIntent(new URL("https://ishortn.ink/auth/sign-up?next=/a"))).toBeNull();
  });

  test("strips empty and oversized values without keeping them", () => {
    const empty = extractShortenIntent(new URL("https://ishortn.ink/auth/sign-up?url=&next=/a"));
    expect(empty?.intent).toBeNull();
    expect(empty?.cleanUrl.search).toBe("?next=%2Fa");

    const long = `https://example.com/${"a".repeat(SHORTEN_INTENT_MAX_LENGTH)}`;
    const oversized = extractShortenIntent(
      new URL(`https://ishortn.ink/auth/sign-up?url=${encodeURIComponent(long)}`),
    );
    expect(oversized?.intent).toBeNull();
    expect(oversized?.cleanUrl.search).toBe("");
  });
});

describe("getPostAuthUrl", () => {
  test("prefers a same-origin next path", () => {
    expect(getPostAuthUrl({ next: "/dashboard/checkout", intent: tagged })).toBe(
      "/dashboard/checkout",
    );
  });

  test("rejects off-site next values", () => {
    expect(getPostAuthUrl({ next: "//evil.com", intent: undefined })).toBe("/dashboard");
    expect(getPostAuthUrl({ next: "/\\evil.com", intent: undefined })).toBe("/dashboard");
  });

  test("sends a shorten intent to the link editor, prefilled", () => {
    expect(getPostAuthUrl({ next: undefined, intent: tagged })).toBe(
      `/dashboard/link/new?url=${encodeURIComponent(tagged)}`,
    );
  });

  test("falls back to the dashboard", () => {
    expect(getPostAuthUrl({ next: undefined, intent: undefined })).toBe("/dashboard");
  });
});
