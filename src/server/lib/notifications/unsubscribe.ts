import crypto from "node:crypto";

import { env } from "@/env.mjs";
import { SUPPORT_EMAIL } from "@/lib/constants/app";
import { getAppUrl } from "@/lib/constants/domains";

export const NOTIFICATION_SETTINGS_PATH = "/dashboard/settings#notifications";
export const UNSUBSCRIBE_PATH = "/api/email/unsubscribe";

// Scoped so the key can't be replayed as a signature for anything else.
const sign = (userId: string, secret: string) =>
  crypto.createHmac("sha256", secret).update(`product-notifications:${userId}`).digest("base64url");

export function createUnsubscribeToken(userId: string, secret: string): string {
  return `${userId}.${sign(userId, secret)}`;
}

/** Returns the user id the token was issued for, or null when it doesn't verify. */
export function verifyUnsubscribeToken(token: string, secret: string): string | null {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const userId = token.slice(0, separator);
  const given = Buffer.from(token.slice(separator + 1));
  const expected = Buffer.from(sign(userId, secret));
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

export function buildUnsubscribeHeaders(
  userId: string,
  secret: string | undefined,
): UnsubscribeHeaders {
  const mailto = `<mailto:${SUPPORT_EMAIL}?subject=Unsubscribe%20from%20notifications>`;
  if (!secret) return { "List-Unsubscribe": mailto };

  const token = encodeURIComponent(createUnsubscribeToken(userId, secret));
  return {
    "List-Unsubscribe": `<${getAppUrl(`${UNSUBSCRIBE_PATH}?token=${token}`)}>, ${mailto}`,
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
