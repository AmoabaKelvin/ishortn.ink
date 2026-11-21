import { and, asc, eq, exists, gt, gte, isNull, lte } from "drizzle-orm";

import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { link, user } from "@/server/db/schema";

import { sendFirstLinkNudgeEmail } from "./notifications/first-link-nudge";
import { isSuppressedSql } from "./notifications/suppression";

const log = logger.child({ component: "first-link-nudge" });

const HOUR_MS = 60 * 60 * 1000;
export const FIRST_LINK_NUDGE_MIN_AGE_MS = 24 * HOUR_MS;
export const FIRST_LINK_NUDGE_MAX_AGE_MS = 72 * HOUR_MS;
const FIRST_LINK_NUDGE_MAX_SENDS = 200;
const BATCH_SIZE = 100;

// mysql2 returns `exists (...)` as 0 or 1.
const isTrue = (value: number | string) => Number(value) === 1;

export type FirstLinkNudgeCandidate = {
  createdAt: Date | null;
  email: string | null;
  banned: boolean | null;
  deletedAt: Date | null;
  productEmailsEnabled: boolean;
  firstLinkNudgeSentAt: Date | null;
  /** Any link the user created, in their personal workspace or a team's. */
  hasLink: boolean;
  /** The address has an active hard bounce or complaint. */
  emailSuppressed: boolean;
};

/**
 * Whether an account is due its one first-link nudge at `now`: signed up 24 to 72 hours ago,
 * hasn't created a link, can be emailed, and hasn't had the nudge before.
 */
export function isFirstLinkNudgeDue(candidate: FirstLinkNudgeCandidate, now: Date): boolean {
  if (!candidate.createdAt || !candidate.email) return false;
  const age = now.getTime() - candidate.createdAt.getTime();
  if (age < FIRST_LINK_NUDGE_MIN_AGE_MS || age > FIRST_LINK_NUDGE_MAX_AGE_MS) return false;
  return (
    !candidate.firstLinkNudgeSentAt &&
    !candidate.hasLink &&
    !candidate.banned &&
    !candidate.deletedAt &&
    candidate.productEmailsEnabled &&
    !candidate.emailSuppressed
  );
}

type SendNudge = (recipient: {
  userId: string;
  email: string;
  name: string | null;
}) => Promise<boolean>;

/**
 * Emails every account that is due the first-link nudge, up to 200 per run. Each account is
 * claimed (`firstLinkNudgeSentAt` set while still null) before its email goes out, so
 * overlapping runs can't both send; the claim is released only when the send is rejected, so
 * the next hourly run retries it inside the 72-hour window.
 */
export async function sendFirstLinkNudges({
  now = new Date(),
  send = sendFirstLinkNudgeEmail,
  maxSends = FIRST_LINK_NUDGE_MAX_SENDS,
}: { now?: Date; send?: SendNudge; maxSends?: number } = {}) {
  const counts = { checked: 0, sent: 0, skipped: 0, failed: 0 };
  const windowStart = new Date(now.getTime() - FIRST_LINK_NUDGE_MAX_AGE_MS);
  const windowEnd = new Date(now.getTime() - FIRST_LINK_NUDGE_MIN_AGE_MS);
  let cursor = "";

  while (counts.sent < maxSends) {
    // The window and the claim column bound the scan to two days of signups; the rest of the
    // rules are applied by isFirstLinkNudgeDue so they live in one place.
    const rows = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        banned: user.banned,
        deletedAt: user.deletedAt,
        productEmailsEnabled: user.productEmailsEnabled,
        firstLinkNudgeSentAt: user.firstLinkNudgeSentAt,
        hasLink: exists(
          db.select({ id: link.id }).from(link).where(eq(link.userId, user.id)),
        ).mapWith(isTrue),
        emailSuppressed: isSuppressedSql(user.email).mapWith(isTrue),
      })
      .from(user)
      .where(
        and(
          gt(user.id, cursor),
          gte(user.createdAt, windowStart),
          lte(user.createdAt, windowEnd),
          isNull(user.firstLinkNudgeSentAt),
        ),
      )
      .orderBy(asc(user.id))
      .limit(BATCH_SIZE);
    if (!rows.length) break;
    cursor = rows[rows.length - 1]!.id;

    for (const row of rows) {
      if (counts.sent >= maxSends) break;
      counts.checked++;
      if (!row.email || !isFirstLinkNudgeDue(row, now)) {
        counts.skipped++;
        continue;
      }

      const [claim] = await db
        .update(user)
        .set({ firstLinkNudgeSentAt: now })
        .where(and(eq(user.id, row.id), isNull(user.firstLinkNudgeSentAt)));
      if (claim.affectedRows !== 1) {
        counts.skipped++;
        continue;
      }

      if (await send({ userId: row.id, email: row.email, name: row.name })) {
        counts.sent++;
      } else {
        counts.failed++;
        await db.update(user).set({ firstLinkNudgeSentAt: null }).where(eq(user.id, row.id));
      }
    }

    if (rows.length < BATCH_SIZE) break;
  }

  log.info(counts, "first link nudges processed");
  return counts;
}
