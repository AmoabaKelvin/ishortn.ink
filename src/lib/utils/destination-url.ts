import { z } from "zod";

export const INVALID_URL_MESSAGE = "Enter a valid URL, e.g. https://example.com";

const SCHEME_PREFIX = /^([a-z][a-z\d+.-]*):(\d+(?:[/?#]|$))?/i;

// A scheme is `name:` (https://, mailto:, tel:5551234), except a host followed by a port:
// "example.org:8080/path" and "localhost:3000" are scheme-less.
function hasScheme(value: string): boolean {
  const match = SCHEME_PREFIX.exec(value);
  if (!match) return false;
  const [, name = "", port] = match;
  return !port || !(name.includes(".") || name.toLowerCase() === "localhost");
}

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

  const schemed = hasScheme(trimmed);
  const candidate = schemed ? trimmed : `https://${trimmed.replace(/^\/\//, "")}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (!schemed && !parsed.hostname.includes(".")) return null;
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
