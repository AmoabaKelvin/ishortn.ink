// The UTM builder sends signed-out users to `/auth/sign-up?url=<tagged URL>`.
// Middleware moves `url` into a cookie and redirects to the same page without
// it, so the destination never reaches the auth page's address bar, where
// Umami, PostHog and Clarity record it and asset requests send it as Referer.
// Edge-safe: imported by src/middleware.ts.

export const SHORTEN_INTENT_COOKIE = "ish_shorten_url";
// Long enough to finish email verification, short enough not to prefill a
// later, unrelated sign-in.
export const SHORTEN_INTENT_MAX_AGE_SECONDS = 60 * 30;
// Browsers drop cookies over ~4 KB; a longer URL is discarded, not stored.
export const SHORTEN_INTENT_MAX_LENGTH = 2048;

const AUTH_PAGE = /^\/auth\/sign-(?:up|in)(?:\/|$)/;

/**
 * For an auth page URL carrying `url`, returns that value and the same URL
 * without it (other params, including utm_*, are kept). Null otherwise.
 */
export function extractShortenIntent(url: URL): { intent: string | null; cleanUrl: URL } | null {
  if (!AUTH_PAGE.test(url.pathname) || !url.searchParams.has("url")) return null;
  const value = url.searchParams.get("url")?.trim() ?? "";
  const cleanUrl = new URL(url);
  cleanUrl.searchParams.delete("url");
  const intent = value && value.length <= SHORTEN_INTENT_MAX_LENGTH ? value : null;
  return { intent, cleanUrl };
}

/** Where to send the user once signed up or in. */
export function getPostAuthUrl({
  next,
  intent,
}: {
  next: string | undefined;
  intent: string | undefined;
}): string {
  // `next` is an internal destination (e.g. checkout). Restrict to same-origin
  // paths to avoid open redirects.
  if (next && /^\/(?![/\\])/.test(next)) return next;
  if (intent) return `/dashboard/link/new?url=${encodeURIComponent(intent)}`;
  return "/dashboard";
}
