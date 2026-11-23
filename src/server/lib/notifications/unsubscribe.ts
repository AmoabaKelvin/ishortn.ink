import crypto from "node:crypto";

import { env } from "@/env.mjs";
import { SUPPORT_EMAIL } from "@/lib/constants/app";
import { getAppUrl } from "@/lib/constants/domains";

export const NOTIFICATION_SETTINGS_PATH = "/dashboard/settings#notifications";
export const UNSUBSCRIBE_PATH = "/api/email/unsubscribe";

/**
 * What an unsubscribe link turns off: every product notification, or only the weekly summary.
 * The weekly summary's links carry `?list=weekly-summary`; links without it are product links.
 */
export type UnsubscribeList = "product-notifications" | "weekly-summary";

export function parseUnsubscribeList(value: string | null): UnsubscribeList {
  return value === "weekly-summary" ? value : "product-notifications";
}

// Scoped so the key can't be replayed as a signature for anything else, and a weekly-summary
// token can't turn off every product email.
const sign = (userId: string, secret: string, list: UnsubscribeList) =>
  crypto.createHmac("sha256", secret).update(`${list}:${userId}`).digest("base64url");

export function createUnsubscribeToken(
  userId: string,
  secret: string,
  list: UnsubscribeList = "product-notifications",
): string {
  return `${userId}.${sign(userId, secret, list)}`;
}

/** Returns the user id the token was issued for, or null when it doesn't verify. */
export function verifyUnsubscribeToken(
  token: string,
  secret: string,
  list: UnsubscribeList = "product-notifications",
): string | null {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const userId = token.slice(0, separator);
  const given = Buffer.from(token.slice(separator + 1));
  const expected = Buffer.from(sign(userId, secret, list));
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;

  return userId;
}

/**
 * List-Unsubscribe headers for recurring notifications (RFC 2369 / RFC 8058).
 * The one-click URL needs a signing secret; the mailto works without one.
 */
export type UnsubscribeHeaders = {
  "List-Unsubscribe": string;
  "List-Unsubscribe-Post"?: "List-Unsubscribe=One-Click";
};

/** The one-click unsubscribe URL, or null when no signing secret is configured. */
export function unsubscribeUrl(
  userId: string,
  secret: string | undefined,
  list: UnsubscribeList = "product-notifications",
): string | null {
  if (!secret) return null;
  const token = encodeURIComponent(createUnsubscribeToken(userId, secret, list));
  const listParam = list === "product-notifications" ? "" : `&list=${list}`;
  return getAppUrl(`${UNSUBSCRIBE_PATH}?token=${token}${listParam}`);
}

export function buildUnsubscribeHeaders(
  userId: string,
  secret: string | undefined,
  list: UnsubscribeList = "product-notifications",
): UnsubscribeHeaders {
  const mailto = `<mailto:${SUPPORT_EMAIL}?subject=Unsubscribe%20from%20notifications>`;
  const url = unsubscribeUrl(userId, secret, list);
  if (!url) return { "List-Unsubscribe": mailto };

  return {
    "List-Unsubscribe": `<${url}>, ${mailto}`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** Footer link and unsubscribe headers shared by the recurring notification senders. */
export function productNotificationOptions(userId: string) {
  return {
    notificationSettingsUrl: getAppUrl(NOTIFICATION_SETTINGS_PATH),
    headers: buildUnsubscribeHeaders(userId, env.EMAIL_UNSUBSCRIBE_SECRET),
  };
}
