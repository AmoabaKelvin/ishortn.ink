import { and, eq, lt, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { customDomain, teamInvite } from "@/server/db/schema";

// Invalid domain retention: 30 days before cleanup
const INVALID_DOMAIN_RETENTION_DAYS = 30;

interface ExpiredDataCleanupResult {
  expiredInvitesDeleted: number;
  invalidDomainsDeleted: number;
}

/**
 * Clean up expired data:
 * - Team invites that have expired (past their expiresAt date)
 * - Custom domains with 'invalid' status older than 30 days
 *
 * Should be called by a daily cron job.
 */
export async function cleanupExpiredData(): Promise<ExpiredDataCleanupResult> {
  const result: ExpiredDataCleanupResult = {
    expiredInvitesDeleted: 0,
    invalidDomainsDeleted: 0,
  };

  const now = new Date();

  // Calculate cutoff date for invalid domains
  const invalidDomainCutoffDate = new Date();
  invalidDomainCutoffDate.setDate(
    invalidDomainCutoffDate.getDate() - INVALID_DOMAIN_RETENTION_DAYS
  );

  // Delete expired team invites (expiresAt has passed and not accepted)
  const expiredInvitesResult = await db
    .delete(teamInvite)
    .where(
      and(
        lt(teamInvite.expiresAt, now),
        sql`${teamInvite.acceptedAt} IS NULL`
      )
    );
  result.expiredInvitesDeleted = expiredInvitesResult[0].affectedRows;

  // Delete invalid custom domains older than 30 days
  // These are domains that users added but never configured properly
  const invalidDomainsResult = await db
    .delete(customDomain)
    .where(
      and(
        eq(customDomain.status, "invalid"),
        lt(customDomain.createdAt, invalidDomainCutoffDate)
      )
    );
  result.invalidDomainsDeleted = invalidDomainsResult[0].affectedRows;

  return result;
}

/**
 * Get stats about expired data pending cleanup (for monitoring)
 */
export async function getExpiredDataCleanupStats() {
  const now = new Date();

  const invalidDomainCutoffDate = new Date();
  invalidDomainCutoffDate.setDate(
    invalidDomainCutoffDate.getDate() - INVALID_DOMAIN_RETENTION_DAYS
  );

  // Count expired invites
  const expiredInvites = await db
    .select({ count: sql<number>`count(*)` })
    .from(teamInvite)
    .where(
      and(
        lt(teamInvite.expiresAt, now),
        sql`${teamInvite.acceptedAt} IS NULL`
      )
    );

  // Count invalid domains older than retention period
  const invalidDomains = await db
    .select({ count: sql<number>`count(*)` })
    .from(customDomain)
    .where(
      and(
        eq(customDomain.status, "invalid"),
        lt(customDomain.createdAt, invalidDomainCutoffDate)
      )
    );

  // Count all pending invites (not yet expired)
  const pendingInvites = await db
    .select({ count: sql<number>`count(*)` })
    .from(teamInvite)
    .where(
      and(
        sql`${teamInvite.expiresAt} >= ${now}`,
        sql`${teamInvite.acceptedAt} IS NULL`
      )
    );

  return {
    expiredInvitesCount: Number(expiredInvites[0]?.count ?? 0),
    invalidDomainsCount: Number(invalidDomains[0]?.count ?? 0),
    pendingInvitesCount: Number(pendingInvites[0]?.count ?? 0),
    invalidDomainRetentionDays: INVALID_DOMAIN_RETENTION_DAYS,
  };
}
