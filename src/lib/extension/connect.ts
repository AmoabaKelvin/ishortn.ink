// The browser extension connect flow (/extension/connect): which requests may receive a token and
// where the result is sent. The token only ever travels in the redirect's fragment, which the
// browser keeps out of requests and logs.

import { z } from "zod";

import { APP_BASE_DOMAIN } from "@/lib/constants/domains";

export const EXTENSION_STATE_MIN_LENGTH = 16;
export const EXTENSION_STATE_MAX_LENGTH = 128;
export const EXTENSION_LABEL_MAX_LENGTH = 64;
export const EXTENSION_UPGRADE_URL = `https://${APP_BASE_DOMAIN}/pricing?utm_source=browser-extension&utm_medium=integration&utm_campaign=extension_upgrade`;

export type ConnectRequest = { redirectUri: string; state: string; label: string | null };

export type ConnectParamsResult =
  | { ok: true; request: ConnectRequest }
  | { ok: false; reason: "redirect_uri" | "state" | "label" };

export function parseRedirectUriList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((uri) => uri.trim())
    .filter(Boolean);
}

// A repeated or non-string parameter counts as missing.
const singleValue = z.string().optional().catch(undefined);

/**
 * Validates the connect page's query (or the consent form's fields). `redirect_uri` must be one
 * of the configured URIs character for character: anything looser would let another site receive
 * the token.
 */
export function parseConnectParams(
  params: { redirect_uri?: unknown; state?: unknown; label?: unknown },
  allowedRedirectUris: string[],
): ConnectParamsResult {
  const redirectUri = singleValue.parse(params.redirect_uri);
  if (!redirectUri || !allowedRedirectUris.includes(redirectUri)) {
    return { ok: false, reason: "redirect_uri" };
  }

  const state = singleValue.parse(params.state);
  if (
    !state ||
    state.length < EXTENSION_STATE_MIN_LENGTH ||
    state.length > EXTENSION_STATE_MAX_LENGTH
  ) {
    return { ok: false, reason: "state" };
  }

  const rawLabel = singleValue.parse(params.label)?.trim() ?? "";
  if (rawLabel.length > EXTENSION_LABEL_MAX_LENGTH) return { ok: false, reason: "label" };

  return { ok: true, request: { redirectUri, state, label: rawLabel || null } };
}

/** `redirect_uri#token=…&state=…` or `redirect_uri#error=access_denied&state=…`. */
export function connectResultUrl(
  redirectUri: string,
  result: { token: string; state: string } | { error: "access_denied"; state: string },
): string {
  const fragment = new URLSearchParams(
    "token" in result
      ? { token: result.token, state: result.state }
      : { error: result.error, state: result.state },
  );
  return `${redirectUri}#${fragment.toString()}`;
}

const BROWSERS = ["Chrome", "Edge", "Firefox", "Brave", "Opera", "Vivaldi", "Arc"];

/** The browser named in a label like "Chrome on macOS", for analytics; "unknown" otherwise. */
export function browserFromLabel(label: string | null): string {
  const first = label?.trim().split(/\s+/)[0]?.toLowerCase();
  return BROWSERS.find((browser) => browser.toLowerCase() === first)?.toLowerCase() ?? "unknown";
}
