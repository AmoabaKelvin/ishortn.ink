import { and, eq, isNull, lt, or, sql } from "drizzle-orm";

import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { customDomain, team, user } from "@/server/db/schema";
import { sendDomainReminderEmail } from "@/server/lib/notifications/domain-reminder";

import { buildVerificationChallenges, getCustomHostname, mapStatus } from "./cloudflare";
import { isDomainActiveOnVercel } from "./vercel-legacy";

import type { CloudflareCustomHostname } from "./cloudflare";

const log = logger.child({ component: "domain-reminder" });

// Reminder throttle: don't send more than once per 7 days
const REMINDER_INTERVAL_DAYS = 7;

/**
 * A domain is healthy when its Cloudflare custom hostname is fully active, or —
 * during the dual-run window — when it is still verified and configured on Vercel.
 */
async function checkDomainHealth(
  domain: string,
): Promise<{ healthy: boolean; hostname: CloudflareCustomHostname | null }> {
  const hostname = await getCustomHostname(domain);

  if (hostname && mapStatus(hostname) === "active") {
    return { healthy: true, hostname };
  }

  const activeOnVercel = await isDomainActiveOnVercel(domain);

  log.debug(
    {
      domain,
      cloudflareStatus: hostname?.status ?? "not_found",
      sslStatus: hostname?.ssl?.status ?? "not_found",
      activeOnVercel,
    },
    "domain health check result",
  );

  return { healthy: activeOnVercel, hostname };
}

interface ReminderResult {
  domainsChecked: number;
  remindersSent: number;
  domainsUpdatedToActive: number;
  errors: Array<{ domain: string; error: string }>;
}

/**
 * Calculate the number of days since a given date.
 */
function calculateDaysSince(date: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Send configuration reminder emails for domains with 'invalid' status.
 * Only sends reminders to domains that haven't received one in the past 7 days.
 *
 * For personal workspaces: sends to the user who owns the domain
 * For team workspaces: sends to the team owner
 */
export async function sendDomainConfigurationReminders(): Promise<ReminderResult> {
  const result: ReminderResult = {
    domainsChecked: 0,
    remindersSent: 0,
    domainsUpdatedToActive: 0,
    errors: [],
  };

  // Calculate cutoff date for reminder throttling
  const reminderCutoffDate = new Date();
  reminderCutoffDate.setDate(reminderCutoffDate.getDate() - REMINDER_INTERVAL_DAYS);

  // Query all invalid domains that need reminders
  // Conditions:
  // 1. status = 'invalid'
  // 2. lastReminderSentAt is NULL (never reminded) OR older than 7 days ago
  const invalidDomains = await db
    .select({
      id: customDomain.id,
      domain: customDomain.domain,
      userId: customDomain.userId,
      teamId: customDomain.teamId,
      createdAt: customDomain.createdAt,
      // User info (for personal workspaces)
      userEmail: user.email,
      userName: user.name,
    })
    .from(customDomain)
    .leftJoin(user, eq(customDomain.userId, user.id))
    .where(
      and(
        eq(customDomain.status, "invalid"),
        or(
          isNull(customDomain.lastReminderSentAt),
          lt(customDomain.lastReminderSentAt, reminderCutoffDate),
        ),
      ),
    );

  result.domainsChecked = invalidDomains.length;

  if (invalidDomains.length === 0) {
    log.debug("no domains need reminders");
    return result;
  }

  // Process each domain
  for (const domainRecord of invalidDomains) {
    const domainName = domainRecord.domain ?? "unknown";

    try {
      // First, verify the domain is actually unhealthy (not active on Cloudflare
      // or legacy Vercel). This prevents sending emails to users who have already
      // fixed their domain configuration
      const { healthy, hostname } = await checkDomainHealth(domainName);

      if (healthy) {
        // Domain is now valid, update our database and skip sending email
        await db
          .update(customDomain)
          .set({ status: "active" })
          .where(eq(customDomain.id, domainRecord.id));

        result.domainsUpdatedToActive++;
        log.info(
          { domain: domainName },
          "domain now valid, updated status to 'active'",
        );
        continue;
      }

      // Determine recipient based on workspace type
      let recipientEmail: string | null = null;
      let recipientName: string | null = null;

      if (domainRecord.teamId) {
        // Team workspace: get team owner's email
        const teamRecord = await db.query.team.findFirst({
          where: eq(team.id, domainRecord.teamId),
          columns: { ownerId: true },
        });

        if (teamRecord) {
          const ownerRecord = await db.query.user.findFirst({
            where: eq(user.id, teamRecord.ownerId),
            columns: { email: true, name: true },
          });

          if (ownerRecord) {
            recipientEmail = ownerRecord.email;
            recipientName = ownerRecord.name;
          }
        }
      } else {
        // Personal workspace: use the user's email
        recipientEmail = domainRecord.userEmail;
        recipientName = domainRecord.userName;
      }

      if (!recipientEmail) {
        log.warn({ domain: domainName }, "no recipient email found");
        result.errors.push({
          domain: domainName,
          error: "No recipient email found",
        });
        continue;
      }

      // Build the current Cloudflare DNS instructions rather than reusing stored
      // (possibly Vercel-era) challenges
      const challenges = buildVerificationChallenges(domainName, hostname);

      // Calculate days misconfigured
      const daysMisconfigured = domainRecord.createdAt
        ? calculateDaysSince(new Date(domainRecord.createdAt))
        : 0;

      // Send the reminder email
      await sendDomainReminderEmail({
        email: recipientEmail,
        recipientName,
        domain: domainName,
        daysMisconfigured,
        challenges,
      });

      // Update lastReminderSentAt after successful send
      await db
        .update(customDomain)
        .set({ lastReminderSentAt: new Date() })
        .where(eq(customDomain.id, domainRecord.id));

      result.remindersSent++;
      log.info(
        { domain: domainName, recipientEmail },
        "reminder sent",
      );
    } catch (error) {
      log.error(
        { err: error, domain: domainName },
        "reminder processing failed",
      );
      result.errors.push({
        domain: domainName,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return result;
}

/**
 * Get stats about domains that may need reminders (for monitoring).
 */
export async function getDomainReminderStats() {
  const reminderCutoffDate = new Date();
  reminderCutoffDate.setDate(reminderCutoffDate.getDate() - REMINDER_INTERVAL_DAYS);

  // Domains needing reminders
  const needingReminders = await db
    .select({ count: sql<number>`count(*)` })
    .from(customDomain)
    .where(
      and(
        eq(customDomain.status, "invalid"),
        or(
          isNull(customDomain.lastReminderSentAt),
          lt(customDomain.lastReminderSentAt, reminderCutoffDate),
        ),
      ),
    );

  // Total invalid domains
  const totalInvalid = await db
    .select({ count: sql<number>`count(*)` })
    .from(customDomain)
    .where(eq(customDomain.status, "invalid"));

  // Recently reminded (within last 7 days)
  const recentlyReminded = await db
    .select({ count: sql<number>`count(*)` })
    .from(customDomain)
    .where(
      and(
        eq(customDomain.status, "invalid"),
        sql`${customDomain.lastReminderSentAt} >= ${reminderCutoffDate}`,
      ),
    );

  return {
    needingReminders: Number(needingReminders[0]?.count ?? 0),
    totalInvalid: Number(totalInvalid[0]?.count ?? 0),
    recentlyReminded: Number(recentlyReminded[0]?.count ?? 0),
    reminderIntervalDays: REMINDER_INTERVAL_DAYS,
  };
}
