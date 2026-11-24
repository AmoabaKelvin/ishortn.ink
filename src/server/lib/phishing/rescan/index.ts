import { and, asc, countDistinct, desc, eq, gt, inArray, isNull, like, or, sql } from "drizzle-orm";
import { z } from "zod";

import { env } from "@/env.mjs";
import { resolvePlan } from "@/lib/billing/plans";
import { PLATFORM_DOMAINS } from "@/lib/constants/domains";
import {
  buildCacheKey,
  deleteFromCache,
  getStringFromCache,
  setStringInCache,
} from "@/lib/core/cache";
import { logger } from "@/lib/logger";
import { runBackgroundTask } from "@/lib/utils/background";
import { db } from "@/server/db";
import { blockedDomain, flaggedLink, geoRule, link, subscription } from "@/server/db/schema";

import { checkGoogleSafeBrowsingBatch, SAFE_BROWSING_BATCH_SIZE } from "../google-safe-browsing";
import { findEmailInRedirect } from "../heuristics";
import { getFeeds, scanFeed } from "./feeds";
import {
  addDestinationToIndex,
  addLinkToIndex,
  addSafeBrowsingCandidate,
  type BacklogFlag,
  backlogDecisions,
  CAP_NOTE_LIKE,
  type BlockedPhishingPaths,
  campaignPatternMatches,
  capBlocks,
  createLinkIndex,
  createSafeBrowsingWindow,
  decideMatch,
  distinctivePath,
  type ExistingFlag,
  flagPayingAccounts,
  indexBlockedPhishingPaths,
  LEGACY_FLAG_DETAILS,
  type LinkIndex,
  mergeDecisions,
  type RescanDecision,
  type RescanMatch,
  remainingBacklog,
  RESCAN_REASON_PREFIX,
  type RescanSource,
  type SafeBrowsingWindow,
  selectSafeBrowsingUrls,
  shortLinkMatches,
  withoutResolvedLinks,
} from "./utils";

const log = logger.child({ component: "phishing.rescan" });

const LINK_PAGE_SIZE = 5000;
const WRITE_CHUNK_SIZE = 500;
// 100 lookups per run, 400 a day at the 6-hour schedule: a few percent of the default Safe
// Browsing quota of 10,000 lookups a day.
const SAFE_BROWSING_MAX_URLS_PER_RUN = 50_000;
const SAFE_BROWSING_CONCURRENCY = 4;
const SAFE_BROWSING_CURSOR_KEY = "phishing-rescan:safe-browsing-cursor";
const SAFE_BROWSING_CURSOR_TTL = 60 * 60 * 24 * 30;
// Blocks over the cap wait in the backlog, which every run (and the backlog-only run every 15
// minutes, see custom-worker.ts) blocks first, so confirmed matches drain at up to ~1,000 an hour.
const MAX_AUTO_BLOCKS_PER_RUN = 250;
// Newest first: a campaign's links are blocked while it runs, so recent blocks carry its paths.
const MAX_BLOCKED_PHISHING_LINKS = 2_000;
const BLOCKED_PATHS_TTL_MS = 10 * 60 * 1000;
const BLOCKED_PATHS_CACHE_KEY = "phishing:blocked-paths:v2";
const OWN_HOSTS: ReadonlySet<string> = new Set(PLATFORM_DOMAINS);

type SourceSummary = {
  entries: number;
  matched: number;
  blocked: number;
  flagged: number;
  error?: string;
};

export type RescanSummary = {
  dryRun: boolean;
  /** Only the backlog was processed; no feeds or Safe Browsing lookups. */
  backlogOnly: boolean;
  linksScanned: number;
  matched: number;
  blocked: number;
  flagged: number;
  /** Matches skipped because an admin already reviewed the link or it is already flagged. */
  skipped: number;
  domainsBlocked: number;
  /** Links with a confirmed block still waiting for a later run because of the cap. */
  backlog: number;
  sources: Partial<Record<RescanSource, SourceSummary>>;
  /** Present in dry runs so the decisions can be reviewed before anything is written. */
  decisions?: RescanDecision[];
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

const isHttpUrl = (url: string) => /^https?:\/\//i.test(url);

/**
 * Re-checks every live link (not blocked, not past its expiry date, on any domain, including the
 * hidden links behind bio-page blocks) and its geo rule destinations against the public phishing
 * feeds and Safe Browsing, then blocks or flags the matches. See `decideMatch` for which evidence
 * blocks and which only flags. The backlog of blocks held back by the per-run cap goes first;
 * `backlogOnly` processes just that.
 */
export async function runPhishingRescan({
  dryRun,
  backlogOnly = false,
}: {
  dryRun: boolean;
  backlogOnly?: boolean;
}): Promise<RescanSummary> {
  const now = new Date();
  const scan = backlogOnly
    ? { linksScanned: 0, sources: {}, matches: [], ownHosts: new Set<string>() }
    : await scanLinks(dryRun, now);
  const { linksScanned, sources, matches } = scan;
  // Read after the scan, which takes minutes, so a backlog-only run in between isn't repeated.
  const backlog = await loadBacklog(MAX_AUTO_BLOCKS_PER_RUN, now);

  const legacyDismissed = dryRun ? 0 : await dismissLegacyFlags(now);
  // Earlier rulings are applied per decision before merging, so evidence an admin already
  // dismissed can't hide a different source's match on the same link.
  const existing = await loadExistingFlags([...new Set(matches.map((m) => m.linkId))]);
  const candidates = matches.flatMap((m) => decideMatch(m, scan.ownHosts) ?? []);
  const merged = mergeDecisions(candidates);
  const fresh = mergeDecisions(withoutResolvedLinks(candidates, existing));
  const held = mergeDecisions([...backlogDecisions(backlog.flags), ...fresh]);
  const paying = await loadPayingLinkIds(
    held.filter((d) => d.action === "block").map((d) => d.linkId),
  );
  const decisions = capBlocks(flagPayingAccounts(held, paying), MAX_AUTO_BLOCKS_PER_RUN);

  const blocks = decisions.filter((d) => d.action === "block");
  const flags = decisions.filter((d) => d.action === "flag");
  const domains = [...new Set(blocks.flatMap((d) => (d.blockDomain ? [d.blockDomain] : [])))];

  for (const [source, ids] of matchedBySource(matches)) {
    const summary = sources[source];
    if (summary) summary.matched = ids.size;
  }
  for (const decision of decisions) {
    const summary = sources[decision.source];
    if (summary) summary[decision.action === "block" ? "blocked" : "flagged"]++;
  }

  if (!dryRun) {
    await applyDecisions(blocks, flags, domains);
  }

  const summary: RescanSummary = {
    dryRun,
    backlogOnly,
    linksScanned,
    matched: new Set(matches.map((m) => m.linkId)).size,
    blocked: blocks.length,
    flagged: flags.length,
    skipped: merged.length - fresh.length,
    domainsBlocked: domains.length,
    backlog: remainingBacklog(backlog.total, decisions),
    sources,
    decisions: dryRun ? decisions : undefined,
  };
  log.info({ ...summary, decisions: undefined, legacyDismissed }, "phishing rescan complete");
  return summary;
}

async function scanLinks(
  dryRun: boolean,
  now: Date,
): Promise<{
  linksScanned: number;
  sources: RescanSummary["sources"];
  matches: RescanMatch[];
  ownHosts: Set<string>;
}> {
  const index = createLinkIndex(PLATFORM_DOMAINS);
  const blockedPaths = await loadBlockedPhishingPaths();
  const matches: RescanMatch[] = [];
  const safeBrowsingEnabled = Boolean(env.GOOGLE_SAFE_BROWSING_API_KEY);
  const safeBrowsingWindow = createSafeBrowsingWindow(
    safeBrowsingEnabled ? Number(await getStringFromCache(SAFE_BROWSING_CURSOR_KEY)) || 0 : 0,
    SAFE_BROWSING_MAX_URLS_PER_RUN,
  );
  let linksScanned = 0;

  // Keyset pagination keeps each query bounded on the Link table.
  let lastId = 0;
  for (;;) {
    const page = await db
      .select({ id: link.id, url: link.url, domain: link.domain, alias: link.alias })
      .from(link)
      .where(
        and(
          gt(link.id, lastId),
          or(eq(link.blocked, false), isNull(link.blocked)),
          or(isNull(link.disableLinkAfterDate), gt(link.disableLinkAfterDate, now)),
        ),
      )
      .orderBy(asc(link.id))
      .limit(LINK_PAGE_SIZE);
    if (page.length === 0) break;

    // Geo rules can send some visitors elsewhere, so their destinations are scanned as the link's.
    const rules = await db
      .select({ linkId: geoRule.linkId, destination: geoRule.destination })
      .from(geoRule)
      .where(
        and(
          inArray(
            geoRule.linkId,
            page.map((row) => row.id),
          ),
          eq(geoRule.action, "redirect"),
        ),
      );
    const ruleDestinations = new Map<number, string[]>();
    for (const rule of rules) {
      if (!rule.destination) continue;
      ruleDestinations.set(rule.linkId, [
        ...(ruleDestinations.get(rule.linkId) ?? []),
        rule.destination,
      ]);
    }

    for (const row of page) {
      addLinkToIndex(index, row);
      const destinations = ruleDestinations.get(row.id) ?? [];
      for (const destination of destinations) addDestinationToIndex(index, row.id, destination);
      for (const url of [row.url, ...destinations]) {
        if (url) matches.push(...campaignPatternMatches(row.id, url, blockedPaths, index.ownHosts));
      }
      if (safeBrowsingEnabled) {
        for (const url of [row.url, ...destinations]) {
          if (url && isHttpUrl(url)) addSafeBrowsingCandidate(safeBrowsingWindow, row.id, url);
        }
      }
    }
    linksScanned += page.length;
    if (page.length < LINK_PAGE_SIZE) break;
    lastId = page[page.length - 1]!.id;
  }

  const sources: RescanSummary["sources"] = {
    "campaign-pattern": { entries: blockedPaths.size, matched: 0, blocked: 0, flagged: 0 },
  };

  // Sequential so only one large feed body is in flight at a time.
  for (const feed of getFeeds()) {
    const result = await scanFeed(feed, index);
    sources[feed.source] = {
      entries: result.entries,
      matched: 0,
      blocked: 0,
      flagged: 0,
      error: result.error,
    };
    if (result.error && feed.url) {
      log.warn({ source: feed.source, error: result.error }, "feed scan failed");
    }
    matches.push(...result.matches);
  }
  matches.push(...(await findListedShortLinks(index, now)));

  const safeBrowsing = safeBrowsingEnabled
    ? await scanSafeBrowsing(safeBrowsingWindow, dryRun)
    : { checked: 0, matches: [], error: "not configured" };
  sources["safe-browsing"] = {
    entries: safeBrowsing.checked,
    matched: 0,
    blocked: 0,
    flagged: 0,
    error: safeBrowsing.error,
  };
  matches.push(...safeBrowsing.matches);

  return { linksScanned, sources, matches, ownHosts: index.ownHosts };
}

// Blocks with URL-level phishing evidence: admin blocks naming phishing, and the URL feeds'
// listings. Host-level feed blocks and Safe Browsing (which covers malware too) say nothing about
// the path, so they never make one a trigger.
const PATH_EVIDENCE_REASONS = (["phishing-database-links", "openphish"] as const).map(
  (source) => `${RESCAN_REASON_PREFIX} ${source}`,
);

/** Distinctive paths of the latest links blocked for phishing; see `indexBlockedPhishingPaths`. */
export async function loadBlockedPhishingPaths(): Promise<Set<string>> {
  const rows = await db
    .select({ url: link.url })
    .from(link)
    .where(
      and(
        eq(link.blocked, true),
        or(
          inArray(link.blockedReason, PATH_EVIDENCE_REASONS),
          and(
            like(link.blockedReason, "%phish%"),
            sql`${link.blockedReason} NOT LIKE ${`${RESCAN_REASON_PREFIX}%`}`,
          ),
        ),
      ),
    )
    .orderBy(desc(link.blockedAt))
    .limit(MAX_BLOCKED_PHISHING_LINKS);
  return indexBlockedPhishingPaths(
    rows.flatMap((row) => (row.url ? [row.url] : [])),
    OWN_HOSTS,
  );
}

const blockedPathsCacheSchema = z.array(z.string());

// Shared through KV so a cold isolate reads one key instead of querying the blocked links, and
// memoised per isolate on top so warm ones skip even that.
async function loadCachedBlockedPhishingPaths(): Promise<Set<string>> {
  const cached = await getStringFromCache(BLOCKED_PATHS_CACHE_KEY);
  if (cached) {
    try {
      return new Set(blockedPathsCacheSchema.parse(JSON.parse(cached)));
    } catch {
      // Unreadable entry: rebuild it below.
    }
  }
  const paths = await loadBlockedPhishingPaths();
  await setStringInCache(
    BLOCKED_PATHS_CACHE_KEY,
    JSON.stringify([...paths]),
    BLOCKED_PATHS_TTL_MS / 1000,
  );
  return paths;
}

let blockedPathsCache: { paths: Promise<BlockedPhishingPaths>; expiresAt: number } | null = null;

function getBlockedPhishingPaths(): Promise<BlockedPhishingPaths> {
  const now = Date.now();
  if (!blockedPathsCache || blockedPathsCache.expiresAt <= now) {
    const paths = loadCachedBlockedPhishingPaths();
    blockedPathsCache = { paths, expiresAt: now + BLOCKED_PATHS_TTL_MS };
    // A failed load isn't cached, so the next write retries.
    paths.catch(() => {
      if (blockedPathsCache?.paths === paths) blockedPathsCache = null;
    });
  }
  return blockedPathsCache.paths;
}

export type LinkDestination = { linkId: number; url: string };

/**
 * Checks new or edited link destinations for known campaign patterns (see
 * `campaignPatternMatches`) and blocks or flags the matches with the rescan's rules: free
 * accounts are blocked, paying and team accounts flagged for review.
 */
export async function checkCampaignPatterns(
  destinations: LinkDestination[],
  // Seam for tests, which share one process and so one cache; callers use the default.
  loadPaths: () => Promise<BlockedPhishingPaths> = getBlockedPhishingPaths,
): Promise<void> {
  const blockedPaths = destinations.some((d) => distinctivePath(d.url))
    ? await loadPaths()
    : new Set<string>();
  const matches = destinations.flatMap((d) =>
    campaignPatternMatches(d.linkId, d.url, blockedPaths, OWN_HOSTS),
  );
  if (matches.length === 0) return;

  const existing = await loadExistingFlags([...new Set(matches.map((m) => m.linkId))]);
  const candidates = matches.flatMap((m) => decideMatch(m, OWN_HOSTS) ?? []);
  const fresh = mergeDecisions(withoutResolvedLinks(candidates, existing));
  if (fresh.length === 0) return;
  const paying = await loadPayingLinkIds(
    fresh.filter((d) => d.action === "block").map((d) => d.linkId),
  );
  const decisions = flagPayingAccounts(fresh, paying);
  const blocks = decisions.filter((d) => d.action === "block");
  const flags = decisions.filter((d) => d.action === "flag");
  await applyDecisions(blocks, flags, []);
  log.warn(
    { linkIds: decisions.map((d) => d.linkId), blocked: blocks.length, flagged: flags.length },
    "link destination matches a known phishing campaign pattern",
  );
}

/**
 * Runs `checkCampaignPatterns` after the response, so link writes wait on nothing. Destinations
 * that can't match (no distinctive path, no email in a redirector) never get this far.
 */
export function checkCampaignPatternsAfterResponse(destinations: LinkDestination[]): void {
  const candidates = destinations.filter(
    (d) => distinctivePath(d.url) !== null || findEmailInRedirect(d.url) !== null,
  );
  if (candidates.length === 0) return;
  const task = checkCampaignPatterns(candidates).catch((err) => {
    log.error({ err }, "campaign pattern check failed");
  });
  // Off-platform (tests, scripts) there is no waitUntil; the task still runs.
  void runBackgroundTask(task).catch(() => undefined);
}

function matchedBySource(matches: RescanMatch[]): Map<RescanSource, Set<number>> {
  const bySource = new Map<RescanSource, Set<number>>();
  for (const m of matches) {
    bySource.set(m.source, (bySource.get(m.source) ?? new Set()).add(m.linkId));
  }
  return bySource;
}

/** Looks up the live links behind short-link URLs the feeds listed, one query per domain chunk. */
async function findListedShortLinks(index: LinkIndex, now: Date): Promise<RescanMatch[]> {
  const aliasesByHost = new Map<string, string[]>();
  for (const listed of index.listedShortLinks.values()) {
    const { host, alias } = listed[0]!;
    aliasesByHost.set(host, [...(aliasesByHost.get(host) ?? []), alias]);
  }

  const matches: RescanMatch[] = [];
  for (const [host, aliases] of aliasesByHost) {
    for (const group of chunk(aliases, WRITE_CHUNK_SIZE)) {
      const rows = await db
        .select({ id: link.id, domain: link.domain, alias: link.alias })
        .from(link)
        .where(
          and(
            eq(link.domain, host),
            inArray(link.alias, group),
            or(eq(link.blocked, false), isNull(link.blocked)),
            or(isNull(link.disableLinkAfterDate), gt(link.disableLinkAfterDate, now)),
          ),
        );
      matches.push(...shortLinkMatches(index, rows));
    }
  }
  return matches;
}

async function scanSafeBrowsing(
  safeBrowsingWindow: SafeBrowsingWindow,
  dryRun: boolean,
): Promise<{ checked: number; matches: RescanMatch[]; error?: string }> {
  const { urls, nextCursor } = selectSafeBrowsingUrls(safeBrowsingWindow);

  const batches = chunk([...urls.keys()], SAFE_BROWSING_BATCH_SIZE);
  const matches: RescanMatch[] = [];
  let failed = 0;

  for (const group of chunk(batches, SAFE_BROWSING_CONCURRENCY)) {
    const results = await Promise.all(group.map((batch) => checkGoogleSafeBrowsingBatch(batch)));
    for (const result of results) {
      if (result.status === "error") {
        failed++;
        continue;
      }
      for (const [url, threats] of result.threatsByUrl) {
        for (const linkId of urls.get(url) ?? []) {
          matches.push({
            linkId,
            source: "safe-browsing",
            kind: "threat",
            // The URL is part of the evidence, so a changed destination isn't covered by an
            // earlier dismissal.
            entry: `${url} (${threats.join(", ")})`,
            host: "",
          });
        }
      }
    }
  }

  // Only move on when the whole window was checked, so a failed run retries the same links.
  if (!dryRun && failed === 0) {
    await setStringInCache(SAFE_BROWSING_CURSOR_KEY, String(nextCursor), SAFE_BROWSING_CURSOR_TTL);
  }

  return {
    checked: urls.size,
    matches,
    error: failed > 0 ? `${failed} of ${batches.length} lookups failed` : undefined,
  };
}

/**
 * The oldest over-the-cap flags on live links, up to `limit`, and how many links wait in total.
 * Flags on links blocked, deleted or expired since are left out rather than resolved.
 */
async function loadBacklog(
  limit: number,
  now: Date,
): Promise<{ flags: BacklogFlag[]; total: number }> {
  const where = and(
    eq(flaggedLink.status, "pending"),
    like(flaggedLink.reason, `${RESCAN_REASON_PREFIX}%`),
    like(flaggedLink.details, CAP_NOTE_LIKE),
    or(eq(link.blocked, false), isNull(link.blocked)),
    or(isNull(link.disableLinkAfterDate), gt(link.disableLinkAfterDate, now)),
  );
  const flags = await db
    .select({
      id: flaggedLink.id,
      linkId: flaggedLink.linkId,
      reason: flaggedLink.reason,
      details: flaggedLink.details,
    })
    .from(flaggedLink)
    .innerJoin(link, eq(link.id, flaggedLink.linkId))
    .where(where)
    .orderBy(asc(flaggedLink.id))
    .limit(limit);
  if (flags.length < limit) return { flags, total: new Set(flags.map((f) => f.linkId)).size };

  const [row] = await db
    .select({ total: countDistinct(flaggedLink.linkId) })
    .from(flaggedLink)
    .innerJoin(link, eq(link.id, flaggedLink.linkId))
    .where(where);
  return { flags, total: row?.total ?? flags.length };
}

/** Links owned by a team (always Ultra) or by a user with an entitled subscription. */
async function loadPayingLinkIds(linkIds: number[]): Promise<Set<number>> {
  const paying = new Set<number>();
  for (const ids of chunk(linkIds, WRITE_CHUNK_SIZE)) {
    const owners = await db
      .select({ id: link.id, userId: link.userId, teamId: link.teamId })
      .from(link)
      .where(inArray(link.id, ids));
    const personal = owners.filter((o) => o.teamId === null);
    for (const o of owners) if (o.teamId !== null) paying.add(o.id);
    if (personal.length === 0) continue;

    const subs = await db
      .select()
      .from(subscription)
      .where(inArray(subscription.userId, [...new Set(personal.map((o) => o.userId))]));
    const paid = new Set(subs.filter((sub) => resolvePlan(sub) !== "free").map((s) => s.userId));
    for (const o of personal) if (paid.has(o.userId)) paying.add(o.id);
  }
  return paying;
}

/**
 * Dismisses pending flags from match types that are now skipped (see `LEGACY_FLAG_DETAILS`).
 * Once none are left this is a no-op, so it is safe on every run.
 */
async function dismissLegacyFlags(now: Date): Promise<number> {
  const [result] = await db
    .update(flaggedLink)
    .set({ status: "dismissed", resolvedAt: now })
    .where(
      and(
        eq(flaggedLink.status, "pending"),
        like(flaggedLink.reason, `${RESCAN_REASON_PREFIX}%`),
        or(...LEGACY_FLAG_DETAILS.map((details) => like(flaggedLink.details, `${details}%`))),
      ),
    );
  const dismissed = result.affectedRows;
  if (dismissed > 0) log.info({ dismissed }, "dismissed pending flags without URL-level evidence");
  return dismissed;
}

async function loadExistingFlags(linkIds: number[]): Promise<ExistingFlag[]> {
  const rows: ExistingFlag[] = [];
  for (const ids of chunk(linkIds, WRITE_CHUNK_SIZE)) {
    rows.push(
      ...(await db
        .select({
          id: flaggedLink.id,
          linkId: flaggedLink.linkId,
          status: flaggedLink.status,
          reason: flaggedLink.reason,
          details: flaggedLink.details,
        })
        .from(flaggedLink)
        .where(inArray(flaggedLink.linkId, ids))),
    );
  }
  return rows;
}

async function applyDecisions(
  blocks: RescanDecision[],
  flags: RescanDecision[],
  domains: string[],
) {
  const now = new Date();
  const cacheKeys: string[] = [];

  for (const group of chunk(blocks, WRITE_CHUNK_SIZE)) {
    await db.transaction(async (tx) => {
      // Locks the links still live, so a link blocked concurrently gets no second block row.
      const live = await tx
        .select({ id: link.id, domain: link.domain, alias: link.alias })
        .from(link)
        .where(
          and(
            inArray(
              link.id,
              group.map((d) => d.linkId),
            ),
            or(eq(link.blocked, false), isNull(link.blocked)),
          ),
        )
        .for("update");
      const liveIds = new Set(live.map((row) => row.id));
      const toBlock = group.filter((d) => liveIds.has(d.linkId));
      if (toBlock.length === 0) return;

      // Links sharing a source share a reason, so one UPDATE per source covers the group.
      const bySource = new Map<string, number[]>();
      for (const d of toBlock) {
        bySource.set(d.reason, [...(bySource.get(d.reason) ?? []), d.linkId]);
      }
      for (const [reason, ids] of bySource) {
        await tx
          .update(link)
          .set({ blocked: true, blockedAt: now, blockedReason: reason })
          .where(inArray(link.id, ids));
      }

      // A pending rescan flag becomes the block's record rather than staying in the review queue.
      // Bounded by MAX_AUTO_BLOCKS_PER_RUN, and only links that already had a pending flag.
      for (const d of toBlock) {
        if (!d.resolvesFlagIds) continue;
        await tx
          .update(flaggedLink)
          .set({ status: "blocked", reason: d.reason, details: d.details, resolvedAt: now })
          .where(
            and(inArray(flaggedLink.id, d.resolvesFlagIds), eq(flaggedLink.status, "pending")),
          );
      }
      const fresh = toBlock.filter((d) => !d.resolvesFlagIds);
      if (fresh.length > 0) {
        await tx.insert(flaggedLink).values(
          fresh.map((d) => ({
            linkId: d.linkId,
            reason: d.reason,
            details: d.details,
            status: "blocked" as const,
            resolvedAt: now,
          })),
        );
      }

      for (const row of live) {
        if (row.alias) cacheKeys.push(buildCacheKey(row.domain, row.alias));
      }
    });
  }

  // A held-back block on a link with a pending rescan flag reuses that flag as its queue entry.
  const newFlags = flags.filter((d) => !d.resolvesFlagIds);
  for (const group of chunk(newFlags, WRITE_CHUNK_SIZE)) {
    await db
      .insert(flaggedLink)
      .values(group.map((d) => ({ linkId: d.linkId, reason: d.reason, details: d.details })));
  }
  // Only links that already had a pending flag, and at most one update per link.
  for (const d of flags) {
    if (!d.relabel || !d.resolvesFlagIds) continue;
    await db
      .update(flaggedLink)
      .set({ reason: d.reason, details: d.details })
      .where(and(inArray(flaggedLink.id, d.resolvesFlagIds), eq(flaggedLink.status, "pending")));
  }

  if (domains.length > 0) {
    const reasonByDomain = new Map(blocks.map((d) => [d.blockDomain, d.reason]));
    await db
      .insert(blockedDomain)
      .values(domains.map((domain) => ({ domain, reason: reasonByDomain.get(domain) ?? null })))
      .onDuplicateKeyUpdate({ set: { domain: sql`domain` } });
  }

  // Cached links would keep redirecting until their TTL ran out.
  await Promise.all(cacheKeys.map((key) => deleteFromCache(key)));
}
