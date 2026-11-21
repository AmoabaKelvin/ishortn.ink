// Server-only (node:url): the auth pages turn the shorten intent cookie into
// the short label they render, so the full URL never reaches the browser
// beyond the cookie itself. Kept apart from shorten-intent.ts, which
// middleware imports.

import { domainToUnicode } from "node:url";

import { normalizeDestinationUrl } from "@/lib/utils/destination-url";

const DISPLAY_MAX_LENGTH = 40;

/**
 * The pending shorten intent as the auth pages show it: hostname (IDN in
 * Unicode) plus the start of the path, cut to 40 characters with an ellipsis.
 * Query and fragment are dropped. Null unless the intent is an http(s) URL;
 * scheme-less input ("example.org/landing") counts, as in the link editor.
 */
export function formatShortenIntentForDisplay(intent: string | undefined): string | null {
  const normalized = intent ? normalizeDestinationUrl(intent) : null;
  if (!normalized) return null;

  const url = new URL(normalized);
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = domainToUnicode(url.hostname) || url.hostname;
  const path = url.pathname === "/" ? "" : url.pathname;
  // Code points, so an emoji or astral character is never cut in half.
  const chars = Array.from(host + path);
  return chars.length > DISPLAY_MAX_LENGTH
    ? `${chars.slice(0, DISPLAY_MAX_LENGTH - 1).join("")}…`
    : chars.join("");
}
