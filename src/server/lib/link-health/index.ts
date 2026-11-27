import {
  and,
  asc,
  count,
  eq,
  exists,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";

import { effectivePlan, teamAccess } from "@/lib/billing/entitlements";
import { getAppUrl } from "@/lib/constants/domains";
import { describeLinkHealth } from "@/lib/link-health";
import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { link, linkHealth, linkVisit, qrcode, subscription, team, user } from "@/server/db/schema";
import {
  sendLinkHealthAlertEmail,
  type SendLinkHealthAlertInput,
} from "@/server/lib/notifications/link-health";
import { isSuppressedSql } from "@/server/lib/notifications/suppression";

import { checkDestination, MAX_SUBREQUESTS_PER_CHECK, type CheckDeps } from "./check";
import { hostLanes, nextLinkHealth, type LinkHealthState } from "./utils";

import type { CheckResult } from "./check";
import type { Plan } from "@/lib/billing/plans";
import type { AnyMySqlColumn } from "drizzle-orm/mysql-core";

const log = logger.child({ component: "link-health" });

const DAY_MS = 24 * 60 * 60 * 1000;
/** Links checked per run; the least recently checked go first, so a backlog rotates. */
export const LINK_HEALTH_MAX_LINKS = 2_000;
/** Below a day so a daily run whose start drifts still rechecks yesterday's links. */
const RECHECK_AFTER_MS = 20 * 60 * 60 * 1000;
/** A link counts as active with a click in this window. */
const ACTIVE_WINDOW_MS = 30 * DAY_MS;
/** Workers allow six simultaneous outbound connections per invocation. */
const CONCURRENCY = 6;
const PER_HOST = 2;
// Stops starting checks well inside the scheduled handler's 15-minute limit and the Workers
// subrequest limit (DNS lookups count); unchecked links go first next run.
const RUN_BUDGET_MS = 10 * 60 * 1000;
const SUBREQUEST_BUDGET = 8_000;
const WRITE_CHUNK = 200;
const MAX_ALERT_ROWS = 5_000;
// Resend allows 2 requests per second per team by default; stay just under it.
const SEND_INTERVAL_MS = 550;
const MAX_CONSECUTIVE_SEND_FAILURES = 5;

// mysql2 returns `exists (...)` as 0 or 1.
const isTrue = (value: number | string) => Number(value) === 1;

const notSet = (column: AnyMySqlColumn) => or(isNull(column), eq(column, false));

const hasQrCode = () =>
  exists(db.select({ id: qrcode.id }).from(qrcode).where(eq(qrcode.linkId, link.id)));
const onQrCode = () => or(eq(link.isQrCode, true), hasQrCode());

type PaidAccounts = {
  userIds: string[];
  teams: Map<number, { ownerId: string; slug: string; plan: Plan }>;
};

/** Accounts on Pro or Ultra (grace included), and teams with Ultra access. */
async function loadPaidAccounts(now: Date): Promise<PaidAccounts> {
  // Bounded by accounts that ever subscribed, and by teams.
  const [subscribers, teams] = await Promise.all([
    db
      .select({
        id: user.id,
        planGracePlan: user.planGracePlan,
        planGraceEndsAt: user.planGraceEndsAt,
        planGraceReason: user.planGraceReason,
        subscription,
      })
      .from(subscription)
      .innerJoin(user, eq(user.id, subscription.userId)),
    db
      .select({
        id: team.id,
        slug: team.slug,
        ownerId: team.ownerId,
        ownerPlanGraceEndsAt: team.ownerPlanGraceEndsAt,
      })
      .from(team)
      .where(isNull(team.deletedAt)),
  ]);

  const plans = new Map(
    subscribers.map((row) => [row.id, effectivePlan(row.subscription, row, now)]),
  );
  const paidTeams = new Map<number, { ownerId: string; slug: string; plan: Plan }>();
  for (const row of teams) {
    const { plan } = teamAccess(plans.get(row.ownerId) ?? "free", row.ownerPlanGraceEndsAt, now);
    if (plan !== "free") paidTeams.set(row.id, { ownerId: row.ownerId, slug: row.slug, plan });
  }
  return {
    userIds: [...plans].flatMap(([id, plan]) => (plan === "free" ? [] : [id])),
    teams: paidTeams,
  };
}

/** Links on a paid account's workspace; undefined when there are none. */
function paidOwnerFilter(paid: PaidAccounts) {
  const teamIds = [...paid.teams.keys()];
  return or(
    teamIds.length ? inArray(link.teamId, teamIds) : undefined,
    paid.userIds.length ? and(isNull(link.teamId), inArray(link.userId, paid.userIds)) : undefined,
  );
}

const liveLink = () =>
  and(notSet(link.archived), notSet(link.blocked), notSet(link.disabled), isNotNull(link.url));

type Candidate = { linkId: number; url: string; health: LinkHealthState | null };

/**
 * Links due a check: live, not checked in the last 20 hours, on an account in good standing,
 * and either on a QR code (every plan) or clicked in the last 30 days (Pro and Ultra).
 */
async function loadCandidates(now: Date, paid: PaidAccounts, limit: number): Promise<Candidate[]> {
  const paidOwner = paidOwnerFilter(paid);
  const clickedRecently = exists(
    db
      .select({ id: linkVisit.id })
      .from(linkVisit)
      .where(
        and(
          eq(linkVisit.linkId, link.id),
          gte(linkVisit.createdAt, new Date(now.getTime() - ACTIVE_WINDOW_MS)),
        ),
      ),
  );
  const paidActive = paidOwner ? and(paidOwner, clickedRecently) : undefined;

  const rows = await db
    .select({
      linkId: link.id,
      url: link.url,
      lastCheckedAt: linkHealth.lastCheckedAt,
      lastStatus: linkHealth.lastStatus,
      lastError: linkHealth.lastError,
      consecutiveFailures: linkHealth.consecutiveFailures,
      brokenSince: linkHealth.brokenSince,
      alertedAt: linkHealth.alertedAt,
    })
    .from(link)
    .innerJoin(user, eq(user.id, link.userId))
    .leftJoin(linkHealth, eq(linkHealth.linkId, link.id))
    .where(
      and(
        liveLink(),
        notSet(user.banned),
        isNull(user.deletedAt),
        or(
          isNull(linkHealth.lastCheckedAt),
          lt(linkHealth.lastCheckedAt, new Date(now.getTime() - RECHECK_AFTER_MS)),
        ),
        paidActive ? or(onQrCode(), paidActive) : onQrCode(),
      ),
    )
    // MySQL sorts NULLs first: never-checked links lead.
    .orderBy(asc(linkHealth.lastCheckedAt), asc(link.id))
    .limit(limit);

  return rows.flatMap(({ linkId, url, lastCheckedAt, ...health }) =>
    url
      ? [
          {
            linkId,
            url,
            health: lastCheckedAt
              ? { ...health, lastCheckedAt, consecutiveFailures: health.consecutiveFailures ?? 0 }
              : null,
          },
        ]
      : [],
  );
}

/**
 * Checks each distinct URL once, at most CONCURRENCY at a time and PER_HOST per destination
 * host, until the time or subrequest budget runs out.
 */
async function checkUrls(
  urls: string[],
  deps: CheckDeps,
  budget: { deadline: number; subrequests: number },
): Promise<Map<string, CheckResult>> {
  const results = new Map<string, CheckResult>();
  const lanes = hostLanes(
    urls.map((url) => ({ url })),
    PER_HOST,
  );
  let used = 0;
  let next = 0;
  const checkDeps: CheckDeps = {
    ...deps,
    onSubrequest: (n) => {
      used += n;
    },
  };
  const hasBudget = () =>
    Date.now() < budget.deadline && used + MAX_SUBREQUESTS_PER_CHECK <= budget.subrequests;

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, lanes.length) }, async () => {
      while (next < lanes.length && hasBudget()) {
        const lane = lanes[next++]!;
        for (const { url } of lane) {
          if (!hasBudget()) return;
          results.set(url, await checkDestination(url, checkDeps));
        }
      }
    }),
  );
  return results;
}

async function writeHealth(rows: Array<LinkHealthState & { linkId: number }>) {
  const fromInsert = (name: string) => sql`values(${sql.identifier(name)})`;
  for (let offset = 0; offset < rows.length; offset += WRITE_CHUNK) {
    await db
      .insert(linkHealth)
      .values(rows.slice(offset, offset + WRITE_CHUNK))
      .onDuplicateKeyUpdate({
        set: {
          lastCheckedAt: fromInsert("lastCheckedAt"),
          lastStatus: fromInsert("lastStatus"),
          lastError: fromInsert("lastError"),
          consecutiveFailures: fromInsert("consecutiveFailures"),
          brokenSince: fromInsert("brokenSince"),
          alertedAt: fromInsert("alertedAt"),
        },
      });
  }
}

type SendAlert = (input: SendLinkHealthAlertInput) => Promise<boolean>;

/**
 * Emails each Pro and Ultra account one list of its links that are broken and not yet alerted
 * (team links go to the team owner). Links are claimed (alertedAt set) before the send and
 * released if Resend rejects it, so the next run retries. Accounts that turned product emails
 * off, or whose address bounced, are marked alerted without an email so they aren't retried.
 */
async function sendAlerts(now: Date, paid: PaidAccounts, send: SendAlert, sendIntervalMs: number) {
  const counts = { recipients: 0, sent: 0, skipped: 0, failed: 0 };
  const paidOwner = paidOwnerFilter(paid);
  if (!paidOwner) return counts;

  const pending = await db
    .select({
      linkId: linkHealth.linkId,
      lastStatus: linkHealth.lastStatus,
      lastError: linkHealth.lastError,
      userId: link.userId,
      teamId: link.teamId,
      alias: link.alias,
      domain: link.domain,
      name: link.name,
      url: link.url,
      isQrCode: link.isQrCode,
      hasQrCode: hasQrCode().mapWith(isTrue),
    })
    .from(linkHealth)
    .innerJoin(link, eq(link.id, linkHealth.linkId))
    .where(
      and(isNotNull(linkHealth.brokenSince), isNull(linkHealth.alertedAt), liveLink(), paidOwner),
    )
    .orderBy(asc(linkHealth.brokenSince), asc(linkHealth.linkId))
    .limit(MAX_ALERT_ROWS);
  if (!pending.length) return counts;

  const byRecipient = new Map<string, typeof pending>();
  for (const row of pending) {
    const recipientId = row.teamId === null ? row.userId : paid.teams.get(row.teamId)?.ownerId;
    if (!recipientId) continue;
    const group = byRecipient.get(recipientId) ?? [];
    if (!byRecipient.has(recipientId)) byRecipient.set(recipientId, group);
    group.push(row);
  }
  counts.recipients = byRecipient.size;

  const linkIds = pending.map((row) => row.linkId);
  const [recipients, clicks] = await Promise.all([
    db
      .select({
        id: user.id,
        email: user.email,
        productEmailsEnabled: user.productEmailsEnabled,
        banned: user.banned,
        deletedAt: user.deletedAt,
        emailSuppressed: isSuppressedSql(user.email).mapWith(isTrue),
      })
      .from(user)
      .where(inArray(user.id, [...byRecipient.keys()])),
    db
      .select({ linkId: linkVisit.linkId, clicks: count() })
      .from(linkVisit)
      .where(
        and(
          inArray(linkVisit.linkId, linkIds),
          gte(linkVisit.createdAt, new Date(now.getTime() - 7 * DAY_MS)),
        ),
      )
      .groupBy(linkVisit.linkId),
  ]);
  const recipientById = new Map(recipients.map((row) => [row.id, row]));
  const clicksByLink = new Map(clicks.map((row) => [row.linkId, row.clicks]));

  const claim = (ids: number[]) =>
    db
      .update(linkHealth)
      .set({ alertedAt: now })
      .where(and(inArray(linkHealth.linkId, ids), isNull(linkHealth.alertedAt)));

  let lastSendAt = 0;
  let consecutiveFailures = 0;
  for (const [recipientId, rows] of byRecipient) {
    if (consecutiveFailures >= MAX_CONSECUTIVE_SEND_FAILURES) break;
    const ids = rows.map((row) => row.linkId);
    const recipient = recipientById.get(recipientId);
    if (
      !recipient?.email ||
      !recipient.productEmailsEnabled ||
      recipient.emailSuppressed ||
      recipient.banned ||
      recipient.deletedAt
    ) {
      counts.skipped++;
      await claim(ids);
      continue;
    }

    const [claimed] = await claim(ids);
    if (claimed.affectedRows === 0) {
      counts.skipped++;
      continue;
    }

    const slugs = new Set(
      rows.map((row) => (row.teamId === null ? null : paid.teams.get(row.teamId)?.slug)),
    );
    const workspaceSlug = slugs.size === 1 ? ([...slugs][0] ?? null) : null;
    const links = rows.map((row) => {
      const slug = row.teamId === null ? null : (paid.teams.get(row.teamId)?.slug ?? null);
      const alias = row.alias ?? "";
      return {
        shortUrl: `${row.domain}/${alias}`,
        name: row.name && row.name !== "Untitled Link" ? row.name : null,
        destination: row.url ?? "",
        problem: describeLinkHealth(row.lastStatus, row.lastError),
        clicksLast7Days: clicksByLink.get(row.linkId) ?? 0,
        onQrCode: !!row.isQrCode || row.hasQrCode,
        analyticsUrl: getAppUrl(
          `/dashboard/analytics/${encodeURIComponent(alias)}?domain=${encodeURIComponent(row.domain)}`,
          slug,
        ),
      };
    });

    const wait = lastSendAt + sendIntervalMs - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastSendAt = Date.now();

    const sent = await send({
      userId: recipientId,
      email: recipient.email,
      links,
      dashboardUrl: getAppUrl("/dashboard", workspaceSlug),
    });
    if (sent) {
      counts.sent++;
      consecutiveFailures = 0;
    } else {
      counts.failed++;
      consecutiveFailures++;
      await db.update(linkHealth).set({ alertedAt: null }).where(inArray(linkHealth.linkId, ids));
    }
  }

  if (consecutiveFailures >= MAX_CONSECUTIVE_SEND_FAILURES) {
    log.warn(counts, "link health alerts stopped after repeated send failures");
  }
  return counts;
}

/**
 * The daily destination check: checks up to LINK_HEALTH_MAX_LINKS due links (identical
 * destinations once), records each link's LinkHealth, then emails Pro and Ultra owners about
 * links that just broke. Free accounts' QR-code links are checked and recorded, not alerted.
 * `dryRun` checks and returns the transitions without writing or emailing.
 */
export async function runLinkHealthCheck({
  now = new Date(),
  deps = {},
  send = sendLinkHealthAlertEmail,
  maxLinks = LINK_HEALTH_MAX_LINKS,
  sendIntervalMs = SEND_INTERVAL_MS,
  dryRun = false,
}: {
  now?: Date;
  deps?: CheckDeps;
  send?: SendAlert;
  maxLinks?: number;
  sendIntervalMs?: number;
  dryRun?: boolean;
} = {}) {
  const started = Date.now();
  const paid = await loadPaidAccounts(now);
  const candidates = await loadCandidates(now, paid, maxLinks);
  const urls = [...new Set(candidates.map((row) => row.url))];
  const results = await checkUrls(urls, deps, {
    deadline: started + RUN_BUDGET_MS,
    subrequests: SUBREQUEST_BUDGET,
  });

  const counts = { candidates: candidates.length, urls: urls.length, checked: 0, broken: 0 };
  const rows: Array<LinkHealthState & { linkId: number }> = [];
  for (const candidate of candidates) {
    const result = results.get(candidate.url);
    if (!result) continue;
    const next = nextLinkHealth(candidate.health, result, now);
    counts.checked++;
    if (next.brokenSince && !candidate.health?.brokenSince) counts.broken++;
    rows.push({ linkId: candidate.linkId, ...next });
  }

  if (dryRun) {
    log.info({ ...counts, dryRun }, "link health checked");
    return { ...counts, alerts: null, previews: rows };
  }

  await writeHealth(rows);
  const alerts = await sendAlerts(now, paid, send, sendIntervalMs);
  log.info({ ...counts, alerts, durationMs: Date.now() - started }, "link health checked");
  return { ...counts, alerts };
}
