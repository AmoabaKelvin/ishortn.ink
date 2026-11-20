import { and, asc, eq, gt, inArray, isNotNull, isNull, lt, not, or, sql } from "drizzle-orm";

import {
  API_ACCESS_NOTICE_DAYS,
  API_FREE_ACCESS_SUNSET_AT,
  getApiAccess,
} from "@/lib/billing/api-access";
import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { subscription, token, user } from "@/server/db/schema";

import {
  API_SUNSET_EMAIL_BATCH_SIZE,
  sendApiSunsetEmails,
} from "./notifications/api-access-sunset";

import type { ApiSunsetRecipient } from "./notifications/api-access-sunset";
import type { ApiAccess } from "@/lib/billing/api-access";

const log = logger.child({ component: "api-access" });

type ApiSunsetEmailKind = "notice" | "reminder";

const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_LEAD_MS = DAY_MS;
// An email counts for an account's current cutoff when sent within this long
// before it. Wider than the notice period because the configured cutoff can be
// a little more than 7 days after release, when the first notices go out.
const SENT_WINDOW_MS = 2 * API_ACCESS_NOTICE_DAYS * DAY_MS;
// Bounds the emails one cron run sends; whatever is left goes out on the next run.
const MAX_SEND_BATCHES_PER_RUN = 5;

/**
 * Subscriptions that certainly grant Pro or Ultra at `now` (a subset of
 * resolvePlan). Coalesced so accounts without a subscription row (NULLs from
 * the left join) count as not paid.
 */
export function paidSubscription(now: Date) {
  const paid = and(
    inArray(subscription.plan, ["pro", "ultra"]),
    or(
      inArray(subscription.status, ["active", "on_trial", "past_due"]),
      and(eq(subscription.status, "cancelled"), gt(subscription.endsAt, now)),
    ),
  );
  return sql`coalesce(${paid}, false)`;
}

/** Which sunset email is due at `now` for an account cut off at `sunsetAt`, if any. */
export function dueApiSunsetEmail(sunsetAt: Date, now: Date): "notice" | "reminder" | null {
  if (now >= sunsetAt) return null;
  return now.getTime() >= sunsetAt.getTime() - REMINDER_LEAD_MS ? "reminder" : "notice";
}

/**
 * The email an account should get now, from its own cutoff. Emails sent long
 * before that cutoff (SENT_WINDOW_MS) belong to an earlier sunset period, e.g.
 * a plan that lapsed, was renewed and lapsed again, so they don't count.
 * Entering the last 24 hours without the notice sends only the reminder.
 */
export function apiSunsetEmailFor(
  access: ApiAccess,
  sent: { noticeSentAt: Date | null; reminderSentAt: Date | null },
  now: Date,
): "notice" | "reminder" | null {
  if (access.status !== "sunsetting") return null;
  const periodStart = access.sunsetAt.getTime() - SENT_WINDOW_MS;
  const sentThisPeriod = (sentAt: Date | null) => !!sentAt && sentAt.getTime() >= periodStart;
  const due = dueApiSunsetEmail(access.sunsetAt, now);
  if (due === "reminder" && !sentThisPeriod(sent.reminderSentAt)) return "reminder";
  if (due === "notice" && !sentThisPeriod(sent.noticeSentAt)) return "notice";
  return null;
}

/**
 * Emails owners of API keys on accounts without a paid plan, each on its own
 * cutoff (the configured one, or 7 days after a lapse): a notice when the
 * sunset period starts and a reminder in its last 24 hours. One email per
 * account per kind and period.
 */
export async function sendApiSunsetEmailsDue(now = new Date()) {
  let sent = 0;
  let skipped = 0;
  let sendBatches = 0;
  let cursor = "";

  // A reminder sent more than SENT_WINDOW_MS ago can't count for a cutoff
  // still ahead, so only those accounts (and never-reminded ones) are read.
  const staleBefore = new Date(now.getTime() - SENT_WINDOW_MS);

  while (sendBatches < MAX_SEND_BATCHES_PER_RUN) {
    const rows = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        noticeSentAt: user.apiSunsetNoticeSentAt,
        reminderSentAt: user.apiSunsetReminderSentAt,
        subscription,
      })
      .from(user)
      .leftJoin(subscription, eq(subscription.userId, user.id))
      .where(
        and(
          gt(user.id, cursor),
          inArray(user.id, db.select({ userId: token.userId }).from(token)),
          or(isNull(user.apiSunsetReminderSentAt), lt(user.apiSunsetReminderSentAt, staleBefore)),
          isNotNull(user.email),
          isNull(user.deletedAt),
          or(isNull(user.banned), eq(user.banned, false)),
          // Skip accounts that are clearly on a paid plan; getApiAccess below
          // makes the final call for everything else.
          not(paidSubscription(now)),
        ),
      )
      .orderBy(asc(user.id))
      .limit(API_SUNSET_EMAIL_BATCH_SIZE);
    if (!rows.length) break;
    cursor = rows.at(-1)?.id ?? cursor;

    const due: { kind: ApiSunsetEmailKind; userId: string; recipient: ApiSunsetRecipient }[] = [];
    for (const row of rows) {
      const access = getApiAccess(row.subscription, API_FREE_ACCESS_SUNSET_AT, now);
      const kind = apiSunsetEmailFor(access, row, now);
      if (!kind || !row.email || access.status !== "sunsetting") continue;
      due.push({
        kind,
        userId: row.id,
        recipient: { email: row.email, name: row.name, sunsetAt: access.sunsetAt },
      });
    }

    const kinds: ApiSunsetEmailKind[] = ["notice", "reminder"];
    for (const kind of kinds) {
      const batch = due.filter((entry) => entry.kind === kind);
      if (!batch.length) continue;
      sendBatches++;
      // Unsent accounts stay unmarked and are retried on the next run.
      const recipients = batch.map((entry) => entry.recipient);
      if (!(await sendApiSunsetEmails(recipients, kind))) continue;
      await db
        .update(user)
        .set(
          kind === "reminder"
            ? { apiSunsetReminderSentAt: now, apiSunsetNoticeSentAt: now }
            : { apiSunsetNoticeSentAt: now },
        )
        .where(
          inArray(
            user.id,
            batch.map((entry) => entry.userId),
          ),
        );
      sent += batch.length;
    }
    skipped += rows.length - due.length;
    if (rows.length < API_SUNSET_EMAIL_BATCH_SIZE) break;
  }

  log.info({ sent, skipped }, "api sunset emails processed");
  return { sent, skipped };
}
