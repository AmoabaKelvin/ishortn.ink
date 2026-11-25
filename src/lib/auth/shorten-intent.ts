// A signed-out visitor who asks to shorten a URL (UTM builder, hero form) goes
// through sign-up first. The URL travels in a cookie, never in the auth page's
// address bar, where Umami and PostHog record it and asset requests
// send it as Referer. The homepage hero and the tool CTAs set the cookie on click,
// so the URL is not in an href either (PostHog records clicked hrefs) and the
// auth page loads without a redirect; middleware moves a `?url=` that still
// arrives on an auth page (older links) into the same cookie with a 307. The auth
// pages read it for the post-auth redirect, and middleware clears it when that
// redirect lands.
// Edge-safe: imported by src/middleware.ts.

import type { NextResponse } from "next/server";

export const SHORTEN_INTENT_COOKIE = "ish_shorten_url";
// Long enough to finish email verification, short enough not to prefill a
// later, unrelated sign-in.
const SHORTEN_INTENT_MAX_AGE_SECONDS = 60 * 30;
// Browsers drop cookies over ~4 KB; a longer URL is discarded, not stored.
export const SHORTEN_INTENT_MAX_LENGTH = 2048;

// Path=/auth: only the auth pages need it, so it isn't sent with every asset
// request. Not HttpOnly: the UTM builder writes it from the browser, and a
// script can't overwrite an HttpOnly cookie of the same name.
export const SHORTEN_INTENT_COOKIE_OPTIONS = {
  path: "/auth",
  maxAge: SHORTEN_INTENT_MAX_AGE_SECONDS,
  sameSite: "lax",
} as const;

const AUTH_PAGE = /^\/auth\/sign-(?:up|in)(?:\/|$)/;
const LINK_EDITOR = "/dashboard/link/new";
// A path on this origin: one leading slash, not followed by another slash or a
// backslash (browsers read `//x` and `/\x` as another host).
const SAME_ORIGIN_PATH = /^\/(?![/\\])/;

/**
 * For an auth page URL carrying `url`, returns that value and the same URL
 * without it (other params, including utm_*, are kept). Null otherwise.
 */
export function extractShortenIntent(url: URL): { intent: string | null; cleanUrl: URL } | null {
  if (!AUTH_PAGE.test(url.pathname) || !url.searchParams.has("url")) return null;
  const value = url.searchParams.get("url");
  const cleanUrl = new URL(url);
  cleanUrl.searchParams.delete("url");
  return { intent: toStorableIntent(value), cleanUrl };
}

function toStorableIntent(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed && trimmed.length <= SHORTEN_INTENT_MAX_LENGTH ? trimmed : null;
}

/**
 * A `document.cookie` assignment that stores `value` as the shorten intent, or
 * clears any earlier one when there is nothing storable. Encoded the way
 * Next's `cookies()` decodes it.
 */
export function serializeShortenIntentCookie(value: string | null, secure: boolean): string {
  const intent = toStorableIntent(value);
  const maxAge = intent ? SHORTEN_INTENT_COOKIE_OPTIONS.maxAge : 0;
  return `${SHORTEN_INTENT_COOKIE}=${encodeURIComponent(intent ?? "")}; Path=${SHORTEN_INTENT_COOKIE_OPTIONS.path}; Max-Age=${maxAge}; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/**
 * Whether this request is where an intent ends up: the post-auth redirect (or
 * the signed-in UTM builder CTA) opening the link editor with `?url=`. The
 * cookie's path keeps it off this request, so callers clear it unconditionally.
 */
export function isShortenIntentLanding(url: URL): boolean {
  return url.pathname === LINK_EDITOR && url.searchParams.has("url");
}

/** Expires the intent cookie; the path must match the one it was set with. */
export function clearShortenIntent(response: NextResponse): NextResponse {
  response.cookies.delete({
    name: SHORTEN_INTENT_COOKIE,
    path: SHORTEN_INTENT_COOKIE_OPTIONS.path,
  });
  return response;
}

/**
 * `redirect_url` as a same-origin path (path + query + hash), or null. Clerk's
 * `auth.protect()` sets it to the absolute URL that was asked for; only the app's
 * own origin (or its `www.` host) is accepted, so it can't become an open redirect.
 */
export function toSameOriginPath(redirectUrl: string | undefined, appUrl: string): string | null {
  // Backslashes are read as slashes by browsers (`/\evil.com`), and `//x` is
  // protocol-relative; both would leave the origin.
  if (!redirectUrl || redirectUrl.includes("\\") || redirectUrl.startsWith("//")) return null;
  let app: URL;
  let target: URL;
  try {
    app = new URL(appUrl);
    target = new URL(redirectUrl, app);
  } catch {
    return null;
  }
  const sameOrigin =
    target.protocol === app.protocol &&
    target.port === app.port &&
    (target.hostname === app.hostname || target.hostname === `www.${app.hostname}`);
  if (!sameOrigin) return null;
  // Checked on the parsed result too: normalisation can turn a same-origin input
  // (`https://ishortn.ink//evil.com`, `/a/..//evil.com`) into a `//` path.
  const path = `${target.pathname}${target.search}${target.hash}`;
  return SAME_ORIGIN_PATH.test(path) ? path : null;
}

/** Where to send the user once signed up or in. */
export function getPostAuthUrl({
  next,
  redirectUrl,
  intent,
  appUrl,
}: {
  next: string | undefined;
  redirectUrl: string | undefined;
  intent: string | undefined;
  appUrl: string;
}): string {
  // `next` is an internal destination (e.g. checkout). Restrict to same-origin
  // paths to avoid open redirects.
  if (next && SAME_ORIGIN_PATH.test(next)) return next;
  // Set by the middleware when a signed-out visitor opens a protected page. It
  // also stays on Clerk's later step URLs (factor-one, factor-two, sso-callback),
  // where `next` is gone.
  const returnPath = toSameOriginPath(redirectUrl, appUrl);
  if (returnPath) return returnPath;
  if (intent) return `${LINK_EDITOR}?url=${encodeURIComponent(intent)}`;
  return "/dashboard";
}
