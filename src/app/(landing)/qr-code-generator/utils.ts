import { Paths } from "@/lib/constants/app";

import { MAX_URL_LENGTH, parseUrl } from "../_lib/parse-url";

import type { ParsedUrlResult } from "../_lib/parse-url";

export { toSvgFile } from "../_lib/qr-export";

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

const QR_TOOL_UTM = "utm_source=ishortn_site&utm_medium=landing&utm_campaign=qr-code-generator";

/**
 * Where the "make it dynamic" CTA goes: straight to the link editor prefilled with `url` when
 * signed in, else to sign-up with the tool's UTM params only. Signed out, `url` rides in the
 * shorten-intent cookie set on click, so it never sits in an href that analytics records.
 */
export const getQrSignupHref = (url: string | null, signedIn: boolean | null): string => {
  if (signedIn) {
    return url ? `/dashboard/link/new?url=${encodeURIComponent(url)}` : "/dashboard/link/new";
  }
  return `${Paths.Signup}?${QR_TOOL_UTM}`;
};
