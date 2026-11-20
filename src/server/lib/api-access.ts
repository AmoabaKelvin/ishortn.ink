import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";

import { env } from "@/env.mjs";
import { getApiAccess, parseApiSunset } from "@/lib/billing/api-access";
import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { subscription, token, user } from "@/server/db/schema";

import {
  API_SUNSET_EMAIL_BATCH_SIZE,
  sendApiSunsetEmails,
} from "./notifications/api-access-sunset";

import type { ApiSunsetRecipient } from "./notifications/api-access-sunset";

const log = logger.child({ component: "api-access" });

const REMINDER_LEAD_MS = 24 * 60 * 60 * 1000;
// Bounds one cron run; whatever is left goes out on the next run.
const MAX_BATCHES_PER_RUN = 5;

export function getConfiguredApiSunset(): Date | null {
  return parseApiSunset(env.API_FREE_ACCESS_SUNSET_AT);
}

/** Which sunset email is due at `now`, if any. */
export function dueApiSunsetEmail(sunsetAt: Date | null, now: Date): "notice" | "reminder" | null {
  if (!sunsetAt || now >= sunsetAt) return null;
  return now.getTime() >= sunsetAt.getTime() - REMINDER_LEAD_MS ? "reminder" : "notice";
}

/**
 * Emails every owner of an API key whose account isn't on a paid plan: a
 * notice once the cutoff is configured, and a reminder in the last 24 hours
 * before it. One email per account; each kind is sent at most once. Does
 * nothing once the cutoff has passed.
 */
export async function sendApiSunsetEmailsDue(now = new Date()) {
  const sunsetAt = getConfiguredApiSunset();
  const kind = dueApiSunsetEmail(sunsetAt, now);
  if (!kind) return { kind, sent: 0, skipped: 0 };

  const sentColumn =
    kind === "reminder" ? user.apiSunsetReminderSentAt : user.apiSunsetNoticeSentAt;
  let sent = 0;
  let skipped = 0;

  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
    const rows = await db
      .select({ id: user.id, email: user.email, name: user.name, subscription })
      .from(user)
      .leftJoin(subscription, eq(subscription.userId, user.id))
      .where(
        and(
          inArray(user.id, db.select({ userId: token.userId }).from(token)),
          isNull(sentColumn),
          isNotNull(user.email),
          isNull(user.deletedAt),
          or(isNull(user.banned), eq(user.banned, false)),
        ),
      )
      .limit(API_SUNSET_EMAIL_BATCH_SIZE);
    if (!rows.length) break;

    const recipients: ApiSunsetRecipient[] = [];
    for (const row of rows) {
      const access = getApiAccess(row.subscription, sunsetAt, now);
      if (access.status === "sunsetting" && row.email) {
        recipients.push({ email: row.email, name: row.name, sunsetAt: access.sunsetAt });
      }
    }

    if (!(await sendApiSunsetEmails(recipients, kind))) break;

    // Paid accounts in the batch are marked too, so they aren't read again.
    await db
      .update(user)
      .set(kind === "reminder" ? { apiSunsetReminderSentAt: now } : { apiSunsetNoticeSentAt: now })
      .where(
        inArray(
          user.id,
          rows.map((row) => row.id),
        ),
      );
    sent += recipients.length;
    skipped += rows.length - recipients.length;
    if (rows.length < API_SUNSET_EMAIL_BATCH_SIZE) break;
  }

  log.info({ kind, sent, skipped }, "api sunset emails processed");
  return { kind, sent, skipped };
}
