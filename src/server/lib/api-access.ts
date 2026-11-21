import { and, asc, eq, gt, inArray, isNotNull, isNull, notInArray, or, sql } from "drizzle-orm";

import { env } from "@/env.mjs";
import { API_ACCESS_NOTICE_DAYS, getApiAccess, parseApiSunset } from "@/lib/billing/api-access";
import { ENTITLED_SUBSCRIPTION_STATUSES } from "@/lib/billing/plans";
import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { apiAccessSunset, subscription, token, user } from "@/server/db/schema";

import {
  API_SUNSET_EMAIL_BATCH_SIZE,
  sendApiSunsetEmails,
} from "./notifications/api-access-sunset";

import type { ApiSunsetEmailKind, ApiSunsetRecipient } from "./notifications/api-access-sunset";

const log = logger.child({ component: "api-access" });

const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_LEAD_MS = DAY_MS;
const SUNSET_ROW_ID = 1;
// While the row doesn't exist yet, re-read it at most this often per isolate.
const UNSET_RECHECK_MS = 60 * 1000;

let cachedSunset: Date | null = null;
let unsetCheckedAt = Number.NEGATIVE_INFINITY;

async function readStoredSunset(): Promise<Date | null> {
  const [row] = await db
    .select({ sunsetAt: apiAccessSunset.sunsetAt })
    .from(apiAccessSunset)
    .where(eq(apiAccessSunset.id, SUNSET_ROW_ID));
  return row?.sunsetAt ?? null;
}

/**
 * The cutoff for keys on accounts without a paid plan, or null until the first
 * sunset cron run has stored it. The stored value never changes once written,
 * so it's cached for the life of the isolate. `API_FREE_ACCESS_SUNSET_AT`
 * overrides it in tests.
 */
export async function getApiSunset(nowMs = Date.now()): Promise<Date | null> {
  const override = parseApiSunset(env.API_FREE_ACCESS_SUNSET_AT);
  if (override) return override;
  if (cachedSunset) return cachedSunset;
  if (nowMs - unsetCheckedAt < UNSET_RECHECK_MS) return null;

  cachedSunset = await readStoredSunset();
  if (!cachedSunset) unsetCheckedAt = nowMs;
  return cachedSunset;
}

/** Tests only: forgets the cached cutoff so the next lookup reads the table. */
export function clearApiSunsetCache() {
  cachedSunset = null;
  unsetCheckedAt = Number.NEGATIVE_INFINITY;
}

/**
 * Stores the cutoff as `now` + 7 days unless one is already stored, and
 * returns the stored value. Insert-if-absent, so concurrent or later runs
 * never move it.
 */
export async function ensureApiSunset(now: Date): Promise<Date> {
  const override = parseApiSunset(env.API_FREE_ACCESS_SUNSET_AT);
  if (override) return override;

  await db
    .insert(apiAccessSunset)
    .values({
      id: SUNSET_ROW_ID,
      sunsetAt: new Date(now.getTime() + API_ACCESS_NOTICE_DAYS * DAY_MS),
    })
    .onDuplicateKeyUpdate({ set: { id: sql`${apiAccessSunset.id}` } });

  const sunsetAt = await readStoredSunset();
  if (!sunsetAt) throw new Error("API access sunset row missing after insert");
  return sunsetAt;
}

/**
 * Which email an account whose keys stop working at `sunsetAt` is due at
 * `now`: the notice until 24 hours before, the reminder in the last 24 hours.
 * Each is sent at most once.
 */
export function dueApiSunsetEmail(
  sunsetAt: Date,
  now: Date,
  sent: { notice: Date | null; reminder: Date | null },
): ApiSunsetEmailKind | null {
  if (now >= sunsetAt) return null;
  if (now.getTime() >= sunsetAt.getTime() - REMINDER_LEAD_MS) {
    return sent.reminder ? null : "reminder";
  }
  return sent.notice ? null : "notice";
}

/**
 * Stores the cutoff on the first run, then emails every owner of an API key
 * whose account isn't on a paid plan: a notice when the cutoff is set (or the
 * account lapses), and a reminder in the last 24 hours before that account's
 * own cutoff. One email per account per kind. Accounts already past their
 * cutoff are marked as handled so later runs skip them.
 */
export async function sendApiSunsetEmailsDue(now = new Date()) {
  const sunsetAt = await ensureApiSunset(now);
  const counts = { notice: 0, reminder: 0, failed: 0, closed: 0 };
  let cursor = "";

  for (;;) {
    const rows = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        noticeSentAt: user.apiSunsetNoticeSentAt,
        reminderSentAt: user.apiSunsetReminderSentAt,
        planGracePlan: user.planGracePlan,
        planGraceEndsAt: user.planGraceEndsAt,
        planGraceReason: user.planGraceReason,
        subscription,
      })
      .from(user)
      .leftJoin(subscription, eq(subscription.userId, user.id))
      .where(
        and(
          gt(user.id, cursor),
          inArray(user.id, db.select({ userId: token.userId }).from(token)),
          or(isNull(user.apiSunsetNoticeSentAt), isNull(user.apiSunsetReminderSentAt)),
          isNotNull(user.email),
          isNull(user.deletedAt),
          or(isNull(user.banned), eq(user.banned, false)),
          // Skip accounts that are plainly paid; the rest are checked below.
          or(
            isNull(subscription.id),
            isNull(subscription.status),
            notInArray(subscription.status, ENTITLED_SUBSCRIPTION_STATUSES),
            eq(subscription.plan, "free"),
          ),
        ),
      )
      .orderBy(asc(user.id))
      .limit(API_SUNSET_EMAIL_BATCH_SIZE);
    if (!rows.length) break;
    cursor = rows[rows.length - 1]!.id;

    const recipients: ApiSunsetRecipient[] = [];
    const closed: string[] = [];
    for (const row of rows) {
      const access = getApiAccess(row.subscription, row, sunsetAt, now);
      if (access.status === "revoked") {
        closed.push(row.id);
        continue;
      }
      if (access.status !== "sunsetting" || !row.email) continue;

      const kind = dueApiSunsetEmail(access.sunsetAt, now, {
        notice: row.noticeSentAt,
        reminder: row.reminderSentAt,
      });
      if (kind) {
        recipients.push({
          userId: row.id,
          email: row.email,
          name: row.name,
          sunsetAt: access.sunsetAt,
          kind,
        });
      }
    }

    const sent = new Set(await sendApiSunsetEmails(recipients));
    for (const kind of ["notice", "reminder"] as const) {
      const ids = recipients
        .filter((r) => r.kind === kind && sent.has(r.userId))
        .map((r) => r.userId);
      if (!ids.length) continue;
      await db
        .update(user)
        .set(
          kind === "reminder" ? { apiSunsetReminderSentAt: now } : { apiSunsetNoticeSentAt: now },
        )
        .where(inArray(user.id, ids));
      counts[kind] += ids.length;
    }
    if (closed.length) {
      await db
        .update(user)
        .set({
          apiSunsetNoticeSentAt: sql`coalesce(${user.apiSunsetNoticeSentAt}, ${now})`,
          apiSunsetReminderSentAt: sql`coalesce(${user.apiSunsetReminderSentAt}, ${now})`,
        })
        .where(inArray(user.id, closed));
    }
    counts.failed += recipients.length - sent.size;
    counts.closed += closed.length;

    if (rows.length < API_SUNSET_EMAIL_BATCH_SIZE) break;
  }

  log.info({ sunsetAt, ...counts }, "api sunset emails processed");
  return { sunsetAt, ...counts };
}
