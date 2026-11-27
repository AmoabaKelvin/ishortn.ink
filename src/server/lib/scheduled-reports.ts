import {
  and,
  asc,
  count,
  eq,
  exists,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";

import { effectivePlan, teamAccess } from "@/lib/billing/entitlements";
import { getPlanCaps } from "@/lib/billing/plans";
import { logger } from "@/lib/logger";
import { absoluteUrl } from "@/lib/utils/absolute-url";
import {
  activeRecipients,
  buildScheduledReportContent,
  coveredScheduleIds,
  creatorCanSeeLink,
  inReportWorkspace,
  reportPeriod,
  type CreatorFolderAccess,
  type ReportPeriod,
} from "@/server/api/routers/scheduled-report/utils";
import { db } from "@/server/db";
import {
  campaign,
  emailSuppression,
  folder,
  folderPermission,
  link,
  linkVisit,
  scheduledReport,
  subscription,
  team,
  teamMember,
  user,
} from "@/server/db/schema";

import {
  sendScheduledReportEmail,
  type ScheduledReportContent,
  type SendScheduledReportInput,
} from "./notifications/scheduled-report";
import { parseScheduledReportRecipientId } from "./notifications/unsubscribe";

import type { ScheduledReportFrequency } from "@/emails/scheduled-report";
import type { Plan } from "@/lib/billing/plans";
import type { ScheduledReport } from "@/server/db/schema";
import type { AnyMySqlColumn } from "drizzle-orm/mysql-core";

const log = logger.child({ component: "scheduled-reports" });

const MAX_SENDS = 300;
const CHUNK_SIZE = 25;
// Resend allows 2 requests per second per team by default; stay just under it.
const SEND_INTERVAL_MS = 550;
// A run of rejected sends means a rate limit, an exhausted quota or a bad sender: stop and let
// the next hourly run retry instead of releasing and re-failing every claim.
const MAX_CONSECUTIVE_FAILURES = 5;
const FREQUENCIES: ScheduledReportFrequency[] = ["weekly", "monthly"];

// Rows of a target table that belong to the schedule's workspace.
const ownedBySchedule = (userId: AnyMySqlColumn, teamId: AnyMySqlColumn) =>
  or(
    eq(teamId, scheduledReport.teamId),
    and(isNull(scheduledReport.teamId), isNull(teamId), eq(userId, scheduledReport.userId)),
  );

/**
 * SQL condition: the schedule's link, folder or campaign still exists in its workspace. Schedules
 * whose target was deleted or moved never send and don't count toward the plan's limit.
 */
export function scheduledReportTargetExists() {
  return or(
    and(
      eq(scheduledReport.targetType, "link"),
      exists(
        db
          .select({ id: link.id })
          .from(link)
          .where(
            and(eq(link.id, scheduledReport.targetId), ownedBySchedule(link.userId, link.teamId)),
          ),
      ),
    ),
    and(
      eq(scheduledReport.targetType, "folder"),
      exists(
        db
          .select({ id: folder.id })
          .from(folder)
          .where(
            and(
              eq(folder.id, scheduledReport.targetId),
              ownedBySchedule(folder.userId, folder.teamId),
            ),
          ),
      ),
    ),
    and(
      eq(scheduledReport.targetType, "campaign"),
      exists(
        db
          .select({ id: campaign.id })
          .from(campaign)
          .where(
            and(
              eq(campaign.id, scheduledReport.targetId),
              ownedBySchedule(campaign.userId, campaign.teamId),
            ),
          ),
      ),
    ),
  );
}

/**
 * Removes one address from one report, from its unsubscribe link (`id` from the token). One
 * conditional UPDATE, so unsubscribes arriving together each land and a repeat is a no-op.
 */
export async function unsubscribeReportRecipient(id: string): Promise<void> {
  const parsed = parseScheduledReportRecipientId(id);
  if (!parsed) return;
  const current = sql`COALESCE(${scheduledReport.unsubscribed}, JSON_ARRAY())`;
  await db
    .update(scheduledReport)
    .set({ unsubscribed: sql`JSON_ARRAY_APPEND(${current}, '$', ${parsed.email})` })
    .where(
      and(
        eq(scheduledReport.id, parsed.reportId),
        sql`NOT JSON_CONTAINS(${current}, JSON_QUOTE(${parsed.email}))`,
      ),
    );
}

type Owner = {
  /** Who the footer says set the report up. */
  senderName: string;
  plan: Plan;
  /** Banned, restricted or deleted owner, or a deleted team. */
  blocked: boolean;
};

const workspaceKey = (row: { userId: string; teamId: number | null }) =>
  row.teamId === null ? `u:${row.userId}` : `t:${row.teamId}`;

/** The plan, sender name and standing of each schedule's workspace. Two queries per chunk. */
async function loadOwners(reports: ScheduledReport[], now: Date): Promise<Map<string, Owner>> {
  const teamIds = [...new Set(reports.flatMap((row) => (row.teamId === null ? [] : [row.teamId])))];
  const teams = teamIds.length
    ? await db
        .select({
          id: team.id,
          name: team.name,
          ownerId: team.ownerId,
          deletedAt: team.deletedAt,
          ownerPlanGraceEndsAt: team.ownerPlanGraceEndsAt,
        })
        .from(team)
        .where(inArray(team.id, teamIds))
    : [];

  const userIds = [
    ...new Set([
      ...reports.filter((row) => row.teamId === null).map((row) => row.userId),
      ...teams.map((row) => row.ownerId),
    ]),
  ];
  const users = userIds.length
    ? await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          banned: user.banned,
          restrictedAt: user.restrictedAt,
          deletedAt: user.deletedAt,
          planGracePlan: user.planGracePlan,
          planGraceEndsAt: user.planGraceEndsAt,
          planGraceReason: user.planGraceReason,
          subscription,
        })
        .from(user)
        .leftJoin(subscription, eq(subscription.userId, user.id))
        .where(inArray(user.id, userIds))
    : [];

  const usersById = new Map(
    users.map((row) => [
      row.id,
      {
        row,
        plan: effectivePlan(row.subscription ?? undefined, row, now),
        blocked: !!row.banned || !!row.restrictedAt || !!row.deletedAt,
      },
    ]),
  );

  const owners = new Map<string, Owner>();
  for (const row of teams) {
    const owner = usersById.get(row.ownerId);
    owners.set(`t:${row.id}`, {
      senderName: row.name,
      plan: owner ? teamAccess(owner.plan, row.ownerPlanGraceEndsAt, now).plan : "free",
      blocked: !owner || owner.blocked || !!row.deletedAt,
    });
  }
  for (const [id, owner] of usersById) {
    owners.set(`u:${id}`, {
      senderName: owner.row.name?.trim() || owner.row.email || "An iShortn user",
      plan: owner.plan,
      blocked: owner.blocked,
    });
  }
  return owners;
}

type TargetLink = {
  id: number;
  userId: string;
  teamId: number | null;
  domain: string;
  alias: string | null;
  name: string | null;
  folderId: number | null;
  campaignId: number | null;
  isBioLink: boolean | null;
  statsShareToken: string | null;
};

const targetLinkColumns = {
  id: link.id,
  userId: link.userId,
  teamId: link.teamId,
  domain: link.domain,
  alias: link.alias,
  name: link.name,
  folderId: link.folderId,
  campaignId: link.campaignId,
  isBioLink: link.isBioLink,
  statsShareToken: link.statsShareToken,
};

type ResolvedTarget = { name: string; statsUrl: string | null; links: TargetLink[] };

/**
 * The folder access of each team schedule's creator over the restricted folders among
 * `folderIds`. Up to three queries per chunk, and none when no team folder is restricted.
 */
async function loadCreatorFolderAccess(
  reports: ScheduledReport[],
  folderIds: number[],
): Promise<CreatorFolderAccess> {
  const access: CreatorFolderAccess = {
    restricted: new Set(),
    admins: new Set(),
    grants: new Set(),
  };
  const teamReports = reports.filter((row) => row.teamId !== null);
  if (!teamReports.length || !folderIds.length) return access;

  const restricted = await db
    .select({ id: folder.id })
    .from(folder)
    .where(and(inArray(folder.id, folderIds), eq(folder.isRestricted, true)));
  for (const row of restricted) access.restricted.add(row.id);
  const creators = [
    ...new Set(teamReports.flatMap((row) => (row.createdBy ? [row.createdBy] : []))),
  ];
  if (!access.restricted.size || !creators.length) return access;

  const teamIds = [
    ...new Set(teamReports.flatMap((row) => (row.teamId === null ? [] : [row.teamId]))),
  ];
  const [admins, grants] = await Promise.all([
    db
      .select({ teamId: teamMember.teamId, userId: teamMember.userId })
      .from(teamMember)
      .where(
        and(
          inArray(teamMember.teamId, teamIds),
          inArray(teamMember.userId, creators),
          inArray(teamMember.role, ["owner", "admin"]),
        ),
      ),
    db
      .select({ folderId: folderPermission.folderId, userId: folderPermission.userId })
      .from(folderPermission)
      .innerJoin(folder, eq(folder.id, folderPermission.folderId))
      .innerJoin(
        teamMember,
        and(eq(teamMember.teamId, folder.teamId), eq(teamMember.userId, folderPermission.userId)),
      )
      .where(
        and(
          inArray(folderPermission.folderId, [...access.restricted]),
          inArray(folderPermission.userId, creators),
        ),
      ),
  ]);
  for (const row of admins) access.admins.add(`${row.teamId}:${row.userId}`);
  for (const row of grants) access.grants.add(`${row.folderId}:${row.userId}`);
  return access;
}

/** Each schedule's target and the links it covers, or nothing when the target is gone. */
async function loadTargets(reports: ScheduledReport[]) {
  const idsOf = (type: ScheduledReport["targetType"]) => [
    ...new Set(reports.filter((row) => row.targetType === type).map((row) => row.targetId)),
  ];
  const linkIds = idsOf("link");
  const folderIds = idsOf("folder");
  const campaignIds = idsOf("campaign");

  const [links, folders, campaigns, members] = await Promise.all([
    linkIds.length ? db.select(targetLinkColumns).from(link).where(inArray(link.id, linkIds)) : [],
    folderIds.length
      ? db
          .select({
            id: folder.id,
            name: folder.name,
            userId: folder.userId,
            teamId: folder.teamId,
          })
          .from(folder)
          .where(inArray(folder.id, folderIds))
      : [],
    campaignIds.length
      ? db
          .select({
            id: campaign.id,
            name: campaign.name,
            userId: campaign.userId,
            teamId: campaign.teamId,
          })
          .from(campaign)
          .where(inArray(campaign.id, campaignIds))
      : [],
    folderIds.length || campaignIds.length
      ? db
          .select(targetLinkColumns)
          .from(link)
          .where(
            or(
              folderIds.length ? inArray(link.folderId, folderIds) : undefined,
              campaignIds.length
                ? and(inArray(link.campaignId, campaignIds), eq(link.isBioLink, false))
                : undefined,
            ),
          )
      : [],
  ]);

  const access = await loadCreatorFolderAccess(reports, [
    ...new Set([
      ...folders.flatMap((row) => (row.teamId === null ? [] : [row.id])),
      ...[...links, ...members].flatMap((row) =>
        row.teamId === null || row.folderId === null ? [] : [row.folderId],
      ),
    ]),
  ]);
  const linksById = new Map(links.map((row) => [row.id, row]));
  const foldersById = new Map(folders.map((row) => [row.id, row]));
  const campaignsById = new Map(campaigns.map((row) => [row.id, row]));

  const targets = new Map<number, ResolvedTarget>();
  for (const report of reports) {
    if (report.targetType === "link") {
      const row = linksById.get(report.targetId);
      if (!row || !inReportWorkspace(report, row)) continue;
      if (!creatorCanSeeLink(report, row.folderId, access)) continue;
      targets.set(report.id, {
        name: `${row.domain}/${row.alias ?? ""}`,
        statsUrl: row.statsShareToken ? absoluteUrl(`/stats/${row.statsShareToken}`) : null,
        links: [row],
      });
      continue;
    }
    const group =
      report.targetType === "folder"
        ? foldersById.get(report.targetId)
        : campaignsById.get(report.targetId);
    if (!group || !inReportWorkspace(report, group)) continue;
    if (report.targetType === "folder" && !creatorCanSeeLink(report, group.id, access)) continue;
    const key = report.targetType === "folder" ? "folderId" : "campaignId";
    targets.set(report.id, {
      name: group.name,
      statsUrl: null,
      // The same links the campaign page shows its viewer: no bio links, no folders they can't see.
      links: members.filter(
        (row) =>
          row[key] === group.id &&
          inReportWorkspace(report, row) &&
          (report.targetType === "folder" || !row.isBioLink) &&
          creatorCanSeeLink(report, row.folderId, access),
      ),
    });
  }
  return targets;
}

/** Clicks per link in the period and the one before, plus the per-link breakdowns. */
async function loadClicks(linkIds: number[], period: ReportPeriod) {
  if (!linkIds.length)
    return { current: [], previous: [], countries: [], devices: [], referrers: [] };
  const inPeriod = (from: Date, to: Date) =>
    and(
      inArray(linkVisit.linkId, linkIds),
      gte(linkVisit.createdAt, from),
      lt(linkVisit.createdAt, to),
    );
  const current = inPeriod(period.start, period.end);
  const [currentRows, previous, countries, devices, referrers] = await Promise.all([
    db
      .select({ linkId: linkVisit.linkId, clicks: count() })
      .from(linkVisit)
      .where(current)
      .groupBy(linkVisit.linkId),
    db
      .select({ linkId: linkVisit.linkId, clicks: count() })
      .from(linkVisit)
      .where(inPeriod(period.previousStart, period.start))
      .groupBy(linkVisit.linkId),
    db
      .select({ linkId: linkVisit.linkId, country: linkVisit.country, clicks: count() })
      .from(linkVisit)
      .where(current)
      .groupBy(linkVisit.linkId, linkVisit.country),
    db
      .select({ linkId: linkVisit.linkId, device: linkVisit.device, clicks: count() })
      .from(linkVisit)
      .where(current)
      .groupBy(linkVisit.linkId, linkVisit.device),
    db
      .select({ linkId: linkVisit.linkId, referer: linkVisit.referer, clicks: count() })
      .from(linkVisit)
      .where(current)
      .groupBy(linkVisit.linkId, linkVisit.referer),
  ]);
  return { current: currentRows, previous, countries, devices, referrers };
}

/** Which schedules each capped workspace's plan still covers (only differs after a downgrade). */
async function loadCoveredIds(reports: ScheduledReport[], owners: Map<string, Owner>) {
  const capped = new Map<string, number>();
  for (const report of reports) {
    const key = workspaceKey(report);
    const cap = getPlanCaps(owners.get(key)?.plan ?? "free").scheduledReportLimit;
    if (cap) capped.set(key, cap);
  }
  if (!capped.size) return null;

  const keys = [...capped.keys()];
  const userIds = keys.filter((key) => key.startsWith("u:")).map((key) => key.slice(2));
  const teamIds = keys.filter((key) => key.startsWith("t:")).map((key) => Number(key.slice(2)));
  const rows = await db
    .select({
      id: scheduledReport.id,
      userId: scheduledReport.userId,
      teamId: scheduledReport.teamId,
    })
    .from(scheduledReport)
    .where(
      and(
        or(
          userIds.length
            ? and(inArray(scheduledReport.userId, userIds), isNull(scheduledReport.teamId))
            : undefined,
          teamIds.length ? inArray(scheduledReport.teamId, teamIds) : undefined,
        ),
        scheduledReportTargetExists(),
      ),
    );

  const idsByWorkspace = new Map<string, number[]>();
  for (const row of rows) {
    const key = workspaceKey(row);
    idsByWorkspace.set(key, [...(idsByWorkspace.get(key) ?? []), row.id]);
  }
  const covered = new Set<number>();
  for (const [key, ids] of idsByWorkspace) {
    for (const id of coveredScheduleIds(ids, capped.get(key))) covered.add(id);
  }
  return { capped, covered };
}

type Send = (input: SendScheduledReportInput) => Promise<boolean>;

export type ScheduledReportPreview = {
  reportId: number;
  recipients: string[];
  content: ScheduledReportContent;
};

/**
 * Sends every scheduled report due for the last complete week (weekly) and month (monthly), up to
 * 300 emails per run, paced under Resend's rate limit. Runs hourly, so reports go out early on
 * Monday and on the 1st and later runs pick up the rest. A schedule's first report covers the
 * period it was created in.
 *
 * Each schedule is claimed for the period by setting lastPeriodKey before anything is sent, so a
 * retried or overlapping run never sends it twice. Schedules that can't send (target deleted,
 * plan no longer covers it, nobody left to send to) are claimed too, so they're looked at once
 * per period. When every send is rejected the claim is released for the next run. `dryRun`
 * returns the contents in `previews` without claiming or sending.
 *
 * Reads raw visits, grouped per chunk of schedules: LinkVisit keeps a year on paid plans, so the
 * previous month is always there.
 */
export async function sendScheduledReports({
  now = new Date(),
  send = sendScheduledReportEmail,
  maxSends = MAX_SENDS,
  sendIntervalMs = SEND_INTERVAL_MS,
  dryRun = false,
}: {
  now?: Date;
  send?: Send;
  maxSends?: number;
  sendIntervalMs?: number;
  dryRun?: boolean;
} = {}) {
  const counts = { due: 0, sent: 0, emails: 0, skipped: 0, failed: 0 };
  const previews: ScheduledReportPreview[] = [];
  let lastSendAt = 0;
  let consecutiveFailures = 0;
  const done = () => counts.emails >= maxSends || consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;

  for (const frequency of FREQUENCIES) {
    const period = reportPeriod(frequency, now);
    let cursor = 0;

    while (!done()) {
      const reports = await db
        .select()
        .from(scheduledReport)
        .where(
          and(
            eq(scheduledReport.frequency, frequency),
            or(
              isNull(scheduledReport.lastPeriodKey),
              ne(scheduledReport.lastPeriodKey, period.key),
            ),
            lt(scheduledReport.createdAt, period.end),
            gt(scheduledReport.id, cursor),
          ),
        )
        .orderBy(asc(scheduledReport.id))
        .limit(CHUNK_SIZE);
      if (!reports.length) break;
      cursor = reports[reports.length - 1]!.id;
      counts.due += reports.length;

      const [owners, targets] = await Promise.all([loadOwners(reports, now), loadTargets(reports)]);
      const coverage = await loadCoveredIds(reports, owners);
      const linkIds = [...new Set([...targets.values()].flatMap((t) => t.links.map((l) => l.id)))];
      const allRecipients = [...new Set(reports.flatMap((row) => row.recipients))];
      const [clicks, suppressedRows] = await Promise.all([
        loadClicks(linkIds, period),
        allRecipients.length
          ? db
              .select({ email: emailSuppression.email })
              .from(emailSuppression)
              .where(
                and(
                  inArray(emailSuppression.email, allRecipients),
                  isNull(emailSuppression.clearedAt),
                ),
              )
          : [],
      ]);
      const suppressed = new Set(suppressedRows.map((row) => row.email));

      for (const report of reports) {
        if (done()) break;
        const key = workspaceKey(report);
        const owner = owners.get(key);
        const target = targets.get(report.id);
        const cap = owner ? getPlanCaps(owner.plan).scheduledReportLimit : 0;
        const covered =
          cap !== 0 && (!coverage?.capped.has(key) || coverage.covered.has(report.id));
        const recipients = activeRecipients(report.recipients, report.unsubscribed, suppressed);

        let content: ScheduledReportContent | null = null;
        if (owner && !owner.blocked && target && covered && recipients.length) {
          const ids = new Set(target.links.map((row) => row.id));
          const mine = <T extends { linkId: number }>(rows: T[]) =>
            rows.filter((row) => ids.has(row.linkId));
          const clicksByLink = new Map(mine(clicks.current).map((row) => [row.linkId, row.clicks]));
          content = buildScheduledReportContent({
            period,
            targetType: report.targetType,
            targetName: target.name,
            senderName: owner.senderName,
            statsUrl: target.statsUrl,
            previousClicks: mine(clicks.previous).reduce((total, row) => total + row.clicks, 0),
            links: target.links.map((row) => ({ ...row, clicks: clicksByLink.get(row.id) ?? 0 })),
            countries: mine(clicks.countries),
            devices: mine(clicks.devices),
            referrers: mine(clicks.referrers),
          });
        }

        if (dryRun) {
          if (content) previews.push({ reportId: report.id, recipients, content });
          else counts.skipped++;
          continue;
        }

        const [claim] = await db
          .update(scheduledReport)
          .set({ lastPeriodKey: period.key })
          .where(
            and(
              eq(scheduledReport.id, report.id),
              report.lastPeriodKey === null
                ? isNull(scheduledReport.lastPeriodKey)
                : eq(scheduledReport.lastPeriodKey, report.lastPeriodKey),
            ),
          );
        if (claim.affectedRows !== 1) continue;
        if (!content) {
          counts.skipped++;
          continue;
        }

        let accepted = 0;
        for (const email of recipients) {
          const wait = lastSendAt + sendIntervalMs - Date.now();
          if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
          lastSendAt = Date.now();
          counts.emails++;
          if (await send({ reportId: report.id, email, content })) accepted++;
        }

        if (accepted > 0) {
          counts.sent++;
          consecutiveFailures = 0;
          await db
            .update(scheduledReport)
            .set({ lastSentAt: new Date() })
            .where(eq(scheduledReport.id, report.id));
        } else {
          counts.failed++;
          consecutiveFailures++;
          await db
            .update(scheduledReport)
            .set({ lastPeriodKey: report.lastPeriodKey })
            .where(
              and(eq(scheduledReport.id, report.id), eq(scheduledReport.lastPeriodKey, period.key)),
            );
        }
      }
    }
  }

  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    log.warn(counts, "scheduled reports stopped after repeated send failures");
  }
  log.info({ ...counts, dryRun }, "scheduled reports processed");
  return { ...counts, previews };
}
