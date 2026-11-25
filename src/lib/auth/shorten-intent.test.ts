import { describe, expect, test } from "bun:test";

import { RequestCookies } from "next/dist/server/web/spec-extension/cookies";
import { NextResponse } from "next/server";

import {
  SHORTEN_INTENT_COOKIE,
  SHORTEN_INTENT_MAX_LENGTH,
  clearShortenIntent,
  extractShortenIntent,
  getPostAuthUrl,
  isShortenIntentLanding,
  serializeShortenIntentCookie,
} from "./shorten-intent";

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

  // The URLs Clerk itself loads on the auth pages: redirecting any of them
  // would loop the handshake or break the sign-in widget.
  test("leaves Clerk's own auth page requests alone", () => {
    for (const url of [
      "https://ishortn.ink/auth/sign-in",
      "https://ishortn.ink/auth/sign-in?redirect_url=https%3A%2F%2Fishortn.ink%2Fdashboard%3Furl%3Dx",
      "https://ishortn.ink/auth/sign-in?__clerk_handshake=eyJ&__clerk_db_jwt=dvb_1",
      "https://ishortn.ink/auth/sign-in/SignIn_clerk_catchall_check_1795256975547",
      "https://ishortn.ink/auth/sign-up/SignUp_clerk_catchall_check_1795256975547",
      "https://ishortn.ink/auth/sign-in/factor-one?__clerk_status=verified",
    ]) {
      expect(extractShortenIntent(new URL(url))).toBeNull();
    }
  });

  test("a cleaned URL is never redirected again", () => {
    const first = extractShortenIntent(
      new URL(`https://ishortn.ink/auth/sign-in?url=${encodeURIComponent(tagged)}&url=y`),
    );
    if (!first) throw new Error("expected a shorten intent");
    expect(first.cleanUrl.searchParams.has("url")).toBe(false);
    expect(extractShortenIntent(first.cleanUrl)).toBeNull();
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

const appUrl = "https://ishortn.ink";
const noRedirect = { redirectUrl: undefined, appUrl };
const pricing = "/dashboard/pricing?utm_source=email&utm_campaign=bfcm2026";

describe("getPostAuthUrl", () => {
  test("prefers a same-origin next path", () => {
    expect(getPostAuthUrl({ ...noRedirect, next: "/dashboard/checkout", intent: tagged })).toBe(
      "/dashboard/checkout",
    );
  });

  test("rejects off-site next values", () => {
    expect(getPostAuthUrl({ ...noRedirect, next: "//evil.com", intent: undefined })).toBe(
      "/dashboard",
    );
    expect(getPostAuthUrl({ ...noRedirect, next: "/\\evil.com", intent: undefined })).toBe(
      "/dashboard",
    );
  });

  test("sends a shorten intent to the link editor, prefilled", () => {
    expect(getPostAuthUrl({ ...noRedirect, next: undefined, intent: tagged })).toBe(
      `/dashboard/link/new?url=${encodeURIComponent(tagged)}`,
    );
  });

  test("returns a same-origin redirect_url as path, query and hash", () => {
    const withRedirect = (redirectUrl: string) =>
      getPostAuthUrl({ next: undefined, intent: undefined, redirectUrl, appUrl });
    expect(withRedirect(`https://ishortn.ink${pricing}`)).toBe(pricing);
    expect(withRedirect(`https://www.ishortn.ink${pricing}#plans`)).toBe(`${pricing}#plans`);
    expect(withRedirect("/dashboard/link/new")).toBe("/dashboard/link/new");
    expect(withRedirect(pricing)).toBe(pricing);
  });

  test("ignores redirect_url values that leave the app's origin", () => {
    for (const redirectUrl of [
      "https://evil.example/",
      "//evil.com",
      "/\\evil.com",
      "\\\\evil.com",
      "https://ishortn.ink.evil.com/",
      "https://evil.com/?x=https://ishortn.ink/",
      "http://ishortn.ink/dashboard",
      "https://ishortn.ink:8443/dashboard",
      "javascript:alert(1)",
      "https://",
      "",
    ]) {
      expect(getPostAuthUrl({ next: undefined, intent: undefined, redirectUrl, appUrl })).toBe(
        "/dashboard",
      );
    }
  });

  test("prefers next over redirect_url", () => {
    expect(
      getPostAuthUrl({
        next: "/dashboard/checkout",
        intent: undefined,
        redirectUrl: `https://ishortn.ink${pricing}`,
        appUrl,
      }),
    ).toBe("/dashboard/checkout");
  });

  test("prefers redirect_url over a shorten intent", () => {
    expect(
      getPostAuthUrl({
        next: undefined,
        intent: tagged,
        redirectUrl: `https://ishortn.ink${pricing}`,
        appUrl,
      }),
    ).toBe(pricing);
  });

  test("falls back to the dashboard", () => {
    expect(getPostAuthUrl({ ...noRedirect, next: undefined, intent: undefined })).toBe(
      "/dashboard",
    );
  });
});

describe("serializeShortenIntentCookie", () => {
  const read = (cookie: string) =>
    new RequestCookies(new Headers({ cookie: cookie.split(";")[0] ?? "" })).get(
      SHORTEN_INTENT_COOKIE,
    )?.value;

  test("stores the URL so the auth page's cookies() reads it back unchanged", () => {
    const cookie = serializeShortenIntentCookie(tagged, true);
    expect(cookie).toContain("; Path=/auth; Max-Age=1800; SameSite=Lax; Secure");
    expect(read(cookie)).toBe(tagged);
  });

  test("omits Secure over http so local development still gets it", () => {
    expect(serializeShortenIntentCookie(tagged, false)).not.toContain("Secure");
  });

  test("clears an earlier intent when there is nothing storable", () => {
    for (const value of [
      null,
      "  ",
      `https://example.com/${"a".repeat(SHORTEN_INTENT_MAX_LENGTH)}`,
    ]) {
      const cookie = serializeShortenIntentCookie(value, true);
      expect(cookie).toContain("Max-Age=0");
      expect(read(cookie)).toBe("");
    }
  });
});

describe("clearing a used intent", () => {
  test("happens where the post-auth redirect lands", () => {
    const landing = new URL(
      getPostAuthUrl({ ...noRedirect, next: undefined, intent: tagged }),
      "https://ishortn.ink",
    );
    expect(isShortenIntentLanding(landing)).toBe(true);
    expect(isShortenIntentLanding(new URL("https://ishortn.ink/dashboard/link/new"))).toBe(false);
    expect(isShortenIntentLanding(new URL("https://ishortn.ink/dashboard?url=x"))).toBe(false);
  });

  test("expires the cookie on the path it was set with", () => {
    const setCookie = clearShortenIntent(NextResponse.next()).headers.get("set-cookie") ?? "";
    expect(setCookie).toStartWith(`${SHORTEN_INTENT_COOKIE}=;`);
    expect(setCookie).toContain("Path=/auth;");
    expect(setCookie).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(serializeShortenIntentCookie(tagged, true)).toContain("; Path=/auth;");
  });
});
