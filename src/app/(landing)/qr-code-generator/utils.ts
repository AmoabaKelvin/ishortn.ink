import { MAX_URL_LENGTH, parseUrl } from "../_lib/parse-url";

import type { ParsedUrlResult } from "../_lib/parse-url";

export const MAX_QR_URL_LENGTH = MAX_URL_LENGTH;

export type QrUrlResult = ParsedUrlResult;

/** The URL a static QR code should encode, so the preview never shows a code that opens nothing. */
export const parseQrUrl = (input: string): QrUrlResult =>
  parseUrl(input, {
    empty: "Enter a URL to generate a QR code.",
    tooLong: `That URL is too long for a QR code. Keep it under ${MAX_QR_URL_LENGTH.toLocaleString()} characters.`,
  });

/** The `?url=` prefill from a location search string, or null when it's missing or invalid. */
export const qrUrlFromSearch = (search: string): string | null => {
  const raw = new URLSearchParams(search).get("url");
  if (raw === null) return null;
  const result = parseQrUrl(raw);
  return result.ok ? result.url : null;
};

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/**
 * A standalone .svg file from the markup of an inline `<svg>`. Inline SVG in HTML doesn't need the
 * namespace, but a file without it opens as plain XML instead of an image.
 */
export const toSvgFile = (markup: string): string => {
  const svg = /^<svg\b[^>]*\sxmlns=/.test(markup)
    ? markup
    : markup.replace(/^<svg\b/, `<svg xmlns="${SVG_NAMESPACE}"`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`;
};
