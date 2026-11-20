import { z } from "zod";

export const INVALID_URL_MESSAGE = "Enter a valid URL, e.g. https://example.com";

const HAS_SCHEME = /^[a-z][a-z\d+.-]*:\/\//i;

/**
 * Turns what a user typed as a link destination into a URL: trims it and adds
 * `https://` when there is no scheme ("example.org" → "https://example.org").
 * Returns null when the result is not a URL. Input that already has a scheme
 * only has to parse, so existing destinations keep working; scheme-less input
 * must also have a dotted host, so a stray word isn't read as `https://word`.
 */
export function normalizeDestinationUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const hasScheme = HAS_SCHEME.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed.replace(/^\/\//, "")}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (!hasScheme && !parsed.hostname.includes(".")) return null;
  return candidate;
}

/** Zod field for link destinations: normalises the value or fails with INVALID_URL_MESSAGE. */
export const destinationUrlSchema = z.string().transform((value, ctx) => {
  const normalized = normalizeDestinationUrl(value);
  if (!normalized) {
    ctx.addIssue({ code: "custom", message: INVALID_URL_MESSAGE });
    return z.NEVER;
  }
  return normalized;
});
