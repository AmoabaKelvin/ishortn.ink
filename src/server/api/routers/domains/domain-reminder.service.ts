import { subDays } from "date-fns";
import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";

import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { customDomain, team, user } from "@/server/db/schema";
import { sendDomainReminderEmail } from "@/server/lib/notifications/domain-reminder";
import { emitDomainVerified, webhookWorkspacePlan } from "@/server/lib/webhooks";

import {
  buildVerificationChallenges,
  getCustomHostname,
  mapStatus,
  wwwFallbackActive,
} from "./cloudflare";
import { domainCanGoLive } from "./domains.service";

import type { CloudflareCustomHostname } from "./cloudflare";
import type { MySqlColumn } from "drizzle-orm/mysql-core";

const log = logger.child({ component: "domain-reminder" });

// Reminder throttle: don't send more than once per 7 days
const REMINDER_INTERVAL_DAYS = 7;
// Pending domains get a few days to finish setup before the first reminder
const PENDING_GRACE_DAYS = 3;

async function checkDomainHealth(
  domain: string,
): Promise<{ healthy: boolean; hostname: CloudflareCustomHostname | null }> {
  const hostname = await getCustomHostname(domain);
  const healthy =
    (!!hostname && mapStatus(hostname) === "active") || (await wwwFallbackActive(domain));

  log.debug(
    {
      domain,
      cloudflareStatus: hostname?.status ?? "not_found",
      sslStatus: hostname?.ssl?.status ?? "not_found",
    },
    "domain health check result",
  );

  return { healthy, hostname };
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
 * Domains that should get a reminder: 'invalid' ones, and 'pending' ones older
 * than PENDING_GRACE_DAYS (setup is still in progress before that), skipping
 * any reminded in the last REMINDER_INTERVAL_DAYS. Domains held for review or
 * rejected are skipped: their state isn't about DNS, and the health check below
 * would otherwise activate them.
 */
function needsReminder(now: Date) {
  const reminderCutoff = subDays(now, REMINDER_INTERVAL_DAYS);
  return and(
    domainCanGoLive,
    or(
      eq(customDomain.status, "invalid"),
      and(
        eq(customDomain.status, "pending"),
        lt(customDomain.createdAt, subDays(now, PENDING_GRACE_DAYS)),
      ),
    ),
    or(
      isNull(customDomain.lastReminderSentAt),
      lt(customDomain.lastReminderSentAt, reminderCutoff),
    ),
  );
}

// An unmatched left join reads as null and passes.
function notModerated(account: { restrictedAt: MySqlColumn; banned: MySqlColumn }) {
  return and(isNull(account.restrictedAt), or(isNull(account.banned), eq(account.banned, false)));
}

/**
 * Send configuration reminder emails for domains that still aren't set up.
 *
 * For personal workspaces: sends to the user who owns the domain
 * For team workspaces: sends to the team owner, linking to the team's workspace
 */
export async function sendDomainConfigurationReminders({
  checkHealth = checkDomainHealth,
  sendReminder = sendDomainReminderEmail,
}: {
  checkHealth?: typeof checkDomainHealth;
  sendReminder?: typeof sendDomainReminderEmail;
} = {}): Promise<ReminderResult> {
  const result: ReminderResult = {
    domainsChecked: 0,
    remindersSent: 0,
    domainsUpdatedToActive: 0,
    errors: [],
  };

  const teamOwner = alias(user, "teamOwner");
  const addedBy = alias(user, "addedBy");

  const domains = await db
    .select({
      id: customDomain.id,
      domain: customDomain.domain,
      userId: customDomain.userId,
      teamId: customDomain.teamId,
      createdAt: customDomain.createdAt,
      teamSlug: team.slug,
      // Team domains go to the team owner, personal ones to the user who added them.
      recipientId: sql<string | null>`coalesce(${teamOwner.id}, ${user.id})`,
      recipientEmail: sql<string | null>`coalesce(${teamOwner.email}, ${user.email})`,
      recipientName: sql<string | null>`coalesce(${teamOwner.name}, ${user.name})`,
      emailsEnabled: sql<
        number | null
      >`coalesce(${teamOwner.productEmailsEnabled}, ${user.productEmailsEnabled})`,
    })
    .from(customDomain)
    .leftJoin(team, eq(customDomain.teamId, team.id))
    .leftJoin(user, and(isNull(customDomain.teamId), eq(customDomain.userId, user.id)))
    .leftJoin(teamOwner, eq(team.ownerId, teamOwner.id))
    .leftJoin(addedBy, eq(customDomain.userId, addedBy.id))
    .where(
      and(
        needsReminder(new Date()),
        or(isNull(customDomain.teamId), isNull(team.deletedAt)),
        // Restricting released these hostnames and only unrestrictUser restores
        // them, so don't mark them active or nag about them. That covers team
        // domains added by a restricted member, since restricting releases
        // every domain the user added.
        notModerated(addedBy),
        notModerated(teamOwner),
      ),
    );

  result.domainsChecked = domains.length;

  if (domains.length === 0) {
    log.debug("no domains need reminders");
    return result;
  }

  for (const domainRecord of domains) {
    const domainName = domainRecord.domain ?? "unknown";

    try {
      // First, verify the domain is actually unhealthy. This prevents sending
      // emails to users who have already fixed their domain configuration
      const { healthy, hostname } = await checkHealth(domainName);

      if (healthy) {
        // Domain is now valid, update our database and skip sending email
        const [updated] = await db
          .update(customDomain)
          .set({ status: "active" })
          .where(and(eq(customDomain.id, domainRecord.id), domainCanGoLive));
        if (updated.affectedRows > 0) {
          const workspace = { userId: domainRecord.userId, teamId: domainRecord.teamId };
          const plan = await webhookWorkspacePlan(db, workspace);
          emitDomainVerified(
            db,
            { ...workspace, plan },
            { id: domainRecord.id, domain: domainName },
          );
        }

        result.domainsUpdatedToActive++;
        log.info({ domain: domainName }, "domain now valid, updated status to 'active'");
        continue;
      }

      const { recipientId, recipientEmail } = domainRecord;
      if (!recipientId || !recipientEmail) {
        log.warn({ domain: domainName }, "no recipient email found");
        result.errors.push({
          domain: domainName,
          error: "No recipient email found",
        });
        continue;
      }

      // The recipient turned off product notification emails.
      if (!domainRecord.emailsEnabled) continue;

      // Build the current Cloudflare DNS instructions rather than reusing stored
      // challenges
      const challenges = buildVerificationChallenges(domainName, hostname);

      const daysMisconfigured = domainRecord.createdAt
        ? calculateDaysSince(new Date(domainRecord.createdAt))
        : 0;

      const sent = await sendReminder({
        userId: recipientId,
        email: recipientEmail,
        recipientName: domainRecord.recipientName,
        domain: domainName,
        teamSlug: domainRecord.teamSlug,
        daysMisconfigured,
        challenges,
      });

      if (!sent) {
        result.errors.push({ domain: domainName, error: "Email send failed" });
        continue;
      }

      // Throttle only delivered reminders, so a failed send is retried on the next run
      await db
        .update(customDomain)
        .set({ lastReminderSentAt: new Date() })
        .where(eq(customDomain.id, domainRecord.id));

      result.remindersSent++;
      log.info({ domain: domainName, recipientId }, "reminder sent");
    } catch (error) {
      log.error({ err: error, domain: domainName }, "reminder processing failed");
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
  const reminderCutoffDate = subDays(new Date(), REMINDER_INTERVAL_DAYS);

  // Domains needing reminders
  const needingReminders = await db
    .select({ count: sql<number>`count(*)` })
    .from(customDomain)
    .where(needsReminder(new Date()));

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
        inArray(customDomain.status, ["invalid", "pending"]),
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
