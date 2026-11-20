import { and, count, eq, gt, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

import { EMPTY_USAGE } from "@/lib/billing/entitlements";
import {
  bioBlock,
  bioPage,
  campaign,
  customDomain,
  folder,
  geoRule,
  link,
  linkMilestone,
  qrcode,
} from "@/server/db/schema";

import type { PlanUsage } from "@/lib/billing/entitlements";
import type { DbClient } from "@/server/lib/user-plan";
import type { AnyMySqlColumn } from "drizzle-orm/mysql-core";

/**
 * Paid-feature usage of personal workspaces (team workspaces follow their
 * owner's plan and are handled per team). One grouped query per table, so the
 * cost doesn't grow with the number of accounts; pass `userIds` to scope it.
 * Only accounts that use something appear in the map.
 */
export async function getPlanUsageByUser(
  dbClient: DbClient,
  userIds?: string[],
  now = new Date(),
): Promise<Map<string, PlanUsage>> {
  if (userIds && userIds.length === 0) return new Map();
  const scope = (column: AnyMySqlColumn) => (userIds ? inArray(column, userIds) : undefined);

  // The owner is joined inside each grouped subquery so the scope applies before
  // grouping; MySQL won't push an outer filter into a grouped derived table.
  const rulesPerLink = dbClient
    .select({ userId: link.userId, total: count().as("total") })
    .from(geoRule)
    .innerJoin(link, eq(link.id, geoRule.linkId))
    .where(and(isNull(link.teamId), scope(link.userId)))
    .groupBy(geoRule.linkId, link.userId)
    .as("rulesPerLink");
  const milestonesPerLink = dbClient
    .select({ userId: link.userId, total: count().as("total") })
    .from(linkMilestone)
    .innerJoin(link, eq(link.id, linkMilestone.linkId))
    .where(and(isNull(link.teamId), scope(link.userId)))
    .groupBy(linkMilestone.linkId, link.userId)
    .as("milestonesPerLink");
  const linkBlocksPerPage = dbClient
    .select({ userId: bioPage.userId, total: count().as("total") })
    .from(bioBlock)
    .innerJoin(bioPage, eq(bioPage.id, bioBlock.bioPageId))
    .where(and(eq(bioBlock.type, "link"), isNull(bioPage.teamId), scope(bioPage.userId)))
    .groupBy(bioBlock.bioPageId, bioPage.userId)
    .as("linkBlocksPerPage");
  const maxPerUser = (
    subquery: typeof rulesPerLink | typeof milestonesPerLink | typeof linkBlocksPerPage,
  ) =>
    dbClient
      .select({ userId: subquery.userId, most: sql<string>`max(${subquery.total})` })
      .from(subquery)
      .groupBy(subquery.userId);

  const flag = (condition: ReturnType<typeof sql>) =>
    sql<string>`coalesce(sum(case when ${condition} then 1 else 0 end), 0)`;
  const hasUtm = sql`${link.utmParams} is not null and json_length(${link.utmParams}) > 0 and ${link.campaignId} is null`;

  const [domains, folders, pages, blocks, campaigns, qrCodes, links, rules, milestones] =
    await Promise.all([
      dbClient
        .select({ userId: customDomain.userId, total: count() })
        .from(customDomain)
        // Every status counts, as in the domain cap and getUsableCustomDomains.
        .where(and(isNull(customDomain.teamId), scope(customDomain.userId)))
        .groupBy(customDomain.userId),
      dbClient
        .select({ userId: folder.userId, total: count() })
        .from(folder)
        .where(and(isNull(folder.teamId), scope(folder.userId)))
        .groupBy(folder.userId),
      dbClient
        .select({
          userId: bioPage.userId,
          total: count(),
          withPaidOptions: flag(
            sql`${bioPage.customDomain} is not null or ${bioPage.removeBranding} = true`,
          ),
        })
        .from(bioPage)
        .where(and(isNull(bioPage.teamId), scope(bioPage.userId)))
        .groupBy(bioPage.userId),
      maxPerUser(linkBlocksPerPage),
      dbClient
        .select({ userId: campaign.userId, total: count() })
        .from(campaign)
        .where(and(isNull(campaign.teamId), eq(campaign.status, "active"), scope(campaign.userId)))
        .groupBy(campaign.userId),
      dbClient
        .select({ userId: qrcode.userId, total: count() })
        .from(qrcode)
        .where(and(isNull(qrcode.teamId), scope(qrcode.userId)))
        .groupBy(qrcode.userId),
      dbClient
        .select({
          userId: link.userId,
          passwordLinks: flag(sql`${link.passwordHash} is not null`),
          scheduledLinks: flag(sql`${link.activateAt} > ${now}`),
          verifiedClickLinks: flag(sql`${link.verifiedClicksEnabled} = true`),
          cloakedLinks: flag(sql`${link.cloaking} = true`),
          utmLinks: flag(hasUtm),
        })
        .from(link)
        .where(
          and(
            isNull(link.teamId),
            scope(link.userId),
            or(
              isNotNull(link.passwordHash),
              gt(link.activateAt, now),
              eq(link.verifiedClicksEnabled, true),
              eq(link.cloaking, true),
              hasUtm,
            ),
          ),
        )
        .groupBy(link.userId),
      maxPerUser(rulesPerLink),
      maxPerUser(milestonesPerLink),
    ]);

  const usage = new Map<string, PlanUsage>();
  const add = (userId: string, values: Partial<PlanUsage>) => {
    usage.set(userId, { ...(usage.get(userId) ?? EMPTY_USAGE), ...values });
  };

  for (const row of domains) add(row.userId, { customDomains: row.total });
  for (const row of folders) add(row.userId, { folders: row.total });
  for (const row of pages) {
    add(row.userId, {
      bioPages: row.total,
      bioPagesWithPaidOptions: Number(row.withPaidOptions),
    });
  }
  for (const row of blocks) add(row.userId, { maxLinkBlocksPerBioPage: Number(row.most) });
  for (const row of campaigns) add(row.userId, { activeCampaigns: row.total });
  for (const row of qrCodes) add(row.userId, { qrCodes: row.total });
  for (const row of links) {
    add(row.userId, {
      passwordLinks: Number(row.passwordLinks),
      scheduledLinks: Number(row.scheduledLinks),
      verifiedClickLinks: Number(row.verifiedClickLinks),
      cloakedLinks: Number(row.cloakedLinks),
      utmLinks: Number(row.utmLinks),
    });
  }
  for (const row of rules) add(row.userId, { maxTargetingRulesPerLink: Number(row.most) });
  for (const row of milestones) add(row.userId, { maxMilestonesPerLink: Number(row.most) });

  return usage;
}
