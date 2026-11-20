import { and, count, eq, exists, gte, lt, sql } from "drizzle-orm";

import { getStringFromCache, setStringInCache } from "@/lib/core/cache";
import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { link, linkCreationFailure, user } from "@/server/db/schema";
import { DISCORD_COLORS, sendDiscordNotification } from "@/server/lib/notifications/discord";

import {
  ALERT_DEBOUNCE_MS,
  FAILURE_WINDOW_MS,
  SIGNUP_WINDOW_MS,
  evaluateLinkCreationAlerts,
  isAlertDebounced,
} from "./alerts";

import type { LinkCreationAlert, LinkCreationHealthStats } from "./alerts";

const log = logger.child({ component: "link-creation-health" });

const FAILURE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const ALERT_KEY_PREFIX = "alert:link-creation:";

async function loadStats(now: Date): Promise<LinkCreationHealthStats> {
  const hourAgo = new Date(now.getTime() - FAILURE_WINDOW_MS);
  const dayAgo = new Date(now.getTime() - SIGNUP_WINDOW_MS);
  // Uses the Link userId index; one probe per new account in the window.
  const hasLink = exists(
    db
      .select({ one: sql`1` })
      .from(link)
      .where(eq(link.userId, user.id)),
  );

  const [failures, [created], [signups]] = await Promise.all([
    db
      .select({
        step: linkCreationFailure.step,
        code: linkCreationFailure.code,
        serverError: linkCreationFailure.serverError,
        lastDay: count(),
        lastHour: sql<number>`sum(${linkCreationFailure.createdAt} >= ${hourAgo})`.mapWith(Number),
      })
      .from(linkCreationFailure)
      .where(gte(linkCreationFailure.createdAt, dayAgo))
      .groupBy(linkCreationFailure.step, linkCreationFailure.code, linkCreationFailure.serverError),
    db
      .select({ value: count() })
      .from(link)
      .where(
        and(gte(link.createdAt, hourAgo), eq(link.isQrCode, false), eq(link.isBioLink, false)),
      ),
    db
      .select({
        total: count(),
        withLinks: sql<number>`coalesce(sum(${hasLink}), 0)`.mapWith(Number),
      })
      .from(user)
      .where(gte(user.createdAt, dayAgo)),
  ]);

  return {
    now,
    linksCreatedLastHour: created?.value ?? 0,
    failures,
    signupsLastDay: signups?.total ?? 0,
    signupsWithLinks: signups?.withLinks ?? 0,
  };
}

function alertKey(alert: LinkCreationAlert) {
  return `${ALERT_KEY_PREFIX}${alert.kind}`;
}

async function lastSentAt(alert: LinkCreationAlert): Promise<Date | null> {
  const value = await getStringFromCache(alertKey(alert));
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function sendAlert(alert: LinkCreationAlert) {
  return sendDiscordNotification({
    embeds: [
      {
        title: alert.title,
        color: DISCORD_COLORS.error,
        fields: [
          ...alert.counts.map((c) => ({
            name: c.label,
            value: c.value.toLocaleString("en-US"),
            inline: true,
          })),
          { name: "Top error code", value: alert.topErrorCode ?? "none recorded", inline: true },
          {
            name: "Window (UTC)",
            value: `${alert.windowStart.toISOString()} → ${alert.windowEnd.toISOString()}`,
            inline: false,
          },
        ],
        timestamp: alert.windowEnd.toISOString(),
        footer: { text: "iShortn Link Creation Health" },
      },
    ],
  });
}

/**
 * Hourly check behind /api/cron/link-creation-health: alerts the ops webhook
 * when link creation fails server-side or new accounts stop creating links,
 * at most once per condition per debounce window.
 */
export async function runLinkCreationHealthCheck(now = new Date()) {
  const stats = await loadStats(now);
  const alerts = evaluateLinkCreationAlerts(stats);

  const sent: string[] = [];
  for (const alert of alerts) {
    if (isAlertDebounced(await lastSentAt(alert), now)) continue;
    // Only start the debounce once the alert went out, so a webhook failure retries next hour.
    if (await sendAlert(alert)) {
      await setStringInCache(alertKey(alert), now.toISOString(), ALERT_DEBOUNCE_MS / 1000);
      sent.push(alert.kind);
    }
  }

  const pruned = await db
    .delete(linkCreationFailure)
    .where(lt(linkCreationFailure.createdAt, new Date(now.getTime() - FAILURE_RETENTION_MS)));

  if (alerts.length > 0) log.warn({ stats, alerts: alerts.map((a) => a.kind), sent }, "alerting");

  return {
    alerts: alerts.map((a) => a.kind),
    sent,
    prunedFailures: pruned[0].affectedRows,
  };
}
