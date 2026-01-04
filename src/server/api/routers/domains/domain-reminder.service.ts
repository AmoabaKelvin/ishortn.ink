import { and, eq, isNull, lt, or, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { customDomain, team, user } from "@/server/db/schema";
import { sendDomainReminderEmail } from "@/server/lib/notifications/domain-reminder";

// Reminder throttle: don't send more than once per 7 days
const REMINDER_INTERVAL_DAYS = 7;

type VercelConfigResponse = {
  misconfigured: boolean;
};

/**
 * Mask an email address for logging purposes (e.g., "john@example.com" -> "j***@example.com")
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const maskedLocal = local.length > 1 ? `${local[0]}***` : "***";
  return `${maskedLocal}@${domain}`;
}

type VercelDomainResponse = {
  verified: boolean;
};

/**
 * Verify domain status with Vercel APIs.
 * Returns true if domain is actually valid (verified and not misconfigured).
 */
async function verifyDomainWithVercel(domain: string): Promise<boolean> {
  try {
    const [configResponse, domainResponse] = await Promise.all([
      fetch(
        `https://api.vercel.com/v6/domains/${domain}/config?teamId=${process.env.TEAM_ID_VERCEL}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${process.env.AUTH_BEARER_TOKEN}`,
            "Content-Type": "application/json",
          },
        },
      ),
      fetch(
        `https://api.vercel.com/v9/projects/${process.env.PROJECT_ID_VERCEL}/domains/${domain}?teamId=${process.env.TEAM_ID_VERCEL}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${process.env.AUTH_BEARER_TOKEN}`,
            "Content-Type": "application/json",
          },
        },
      ),
    ]);

    if (!configResponse.ok || !domainResponse.ok) {
      // If API calls fail, assume domain is still invalid to be safe
      console.error(
        `[Domain Reminder] Vercel API check failed for ${domain}: config=${configResponse.status}, domain=${domainResponse.status}`,
      );
      return false;
    }

    const configData = (await configResponse.json()) as VercelConfigResponse;
    const domainData = (await domainResponse.json()) as VercelDomainResponse;

    // Domain is valid if it's verified and not misconfigured
    const isValid = domainData.verified && !configData.misconfigured;

    console.log(
      `[Domain Reminder] Vercel check for ${domain}: verified=${domainData.verified}, misconfigured=${configData.misconfigured}, isValid=${isValid}`,
    );

    return isValid;
  } catch (error) {
    console.error(`[Domain Reminder] Error checking Vercel API for ${domain}:`, error);
    // On error, assume domain is still invalid to be safe
    return false;
  }
}

type Challenge = {
  type: "TXT" | "A" | "CNAME";
  domain: string;
  value: string;
};

interface ReminderResult {
  domainsChecked: number;
  remindersSent: number;
  domainsUpdatedToActive: number;
  errors: Array<{ domain: string; error: string }>;
}

/**
 * Parse verification details from JSON storage.
 * Handles both stringified JSON and already-parsed arrays.
 */
function parseVerificationDetails(verificationDetails: unknown): Challenge[] {
  try {
    if (Array.isArray(verificationDetails)) {
      return verificationDetails as Challenge[];
    }
    if (typeof verificationDetails === "string") {
      return JSON.parse(verificationDetails) as Challenge[];
    }
    return [];
  } catch {
    return [];
  }
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
      verificationDetails: customDomain.verificationDetails,
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
    console.log("[Domain Reminder] No domains need reminders");
    return result;
  }

  // Process each domain
  for (const domainRecord of invalidDomains) {
    const domainName = domainRecord.domain ?? "unknown";

    try {
      // First, verify with Vercel API if the domain is actually invalid
      // This prevents sending emails to users who have already fixed their domain configuration
      const isActuallyValid = await verifyDomainWithVercel(domainName);

      if (isActuallyValid) {
        // Domain is now valid according to Vercel, update our database and skip sending email
        await db
          .update(customDomain)
          .set({ status: "active" })
          .where(eq(customDomain.id, domainRecord.id));

        result.domainsUpdatedToActive++;
        console.log(
          `[Domain Reminder] Domain ${domainName} is now valid, updated status to 'active'`,
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
        console.error(`[Domain Reminder] No recipient email found for domain ${domainName}`);
        result.errors.push({
          domain: domainName,
          error: "No recipient email found",
        });
        continue;
      }

      // Parse verification challenges
      const challenges = parseVerificationDetails(domainRecord.verificationDetails);

      if (challenges.length === 0) {
        console.error(
          `[Domain Reminder] No verification challenges found for domain ${domainName}`,
        );
        result.errors.push({
          domain: domainName,
          error: "No verification challenges found",
        });
        continue;
      }

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
      console.log(`[Domain Reminder] Sent reminder for ${domainName} to ${maskEmail(recipientEmail)}`);
    } catch (error) {
      console.error(`[Domain Reminder] Failed for ${domainName}:`, error);
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
