import { and, asc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";

import { env } from "@/env.mjs";
import { PLATFORM_DOMAINS } from "@/lib/constants/domains";
import {
  buildCacheKey,
  deleteFromCache,
  getStringFromCache,
  setStringInCache,
} from "@/lib/core/cache";
import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { blockedDomain, flaggedLink, link } from "@/server/db/schema";

import { checkGoogleSafeBrowsingBatch, SAFE_BROWSING_BATCH_SIZE } from "../google-safe-browsing";
import { getFeeds, scanFeed } from "./feeds";
import {
  addLinkToIndex,
  capBlocks,
  createLinkIndex,
  decideMatch,
  type ExistingFlag,
  mergeDecisions,
  type RescanDecision,
  type RescanMatch,
  type RescanSource,
  type SafeBrowsingCandidate,
  selectSafeBrowsingUrls,
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
const MAX_AUTO_BLOCKS_PER_RUN = 250;

type SourceSummary = {
  entries: number;
  matched: number;
  blocked: number;
  flagged: number;
  error?: string;
};

export type RescanSummary = {
  dryRun: boolean;
  linksScanned: number;
  matched: number;
  blocked: number;
  flagged: number;
  /** Matches skipped because an admin already reviewed the link or it is already flagged. */
  skipped: number;
  domainsBlocked: number;
  sources: Partial<Record<RescanSource, SourceSummary>>;
  /** Present in dry runs so the decisions can be reviewed before anything is written. */
  decisions?: RescanDecision[];
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * Re-checks every live link (not blocked, not past its expiry date, on any domain, including the
 * hidden links behind bio-page blocks) against the public phishing feeds and Safe Browsing, then
 * blocks or flags the matches. See `decideMatch` for which evidence blocks and which only flags.
 */
export async function runPhishingRescan({ dryRun }: { dryRun: boolean }): Promise<RescanSummary> {
  const index = createLinkIndex(PLATFORM_DOMAINS);
  const safeBrowsingCandidates: SafeBrowsingCandidate[] = [];
  const links = new Map<number, { domain: string; alias: string | null }>();

  // Keyset pagination keeps each query bounded on the Link table.
  let lastId = 0;
  const now = new Date();
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

    for (const row of page) {
      addLinkToIndex(index, row);
      links.set(row.id, { domain: row.domain, alias: row.alias });
      if (row.url && /^https?:\/\//i.test(row.url)) {
        safeBrowsingCandidates.push({ id: row.id, url: row.url });
      }
    }
    if (page.length < LINK_PAGE_SIZE) break;
    lastId = page[page.length - 1]!.id;
  }

  const sources: RescanSummary["sources"] = {};
  const matches: RescanMatch[] = [];

  // Sequential so only one large feed body is in flight at a time.
  for (const feed of getFeeds()) {
    const result = await scanFeed(feed, index);
    sources[feed.source] = {
      entries: result.entries,
      matched: new Set(result.matches.map((m) => m.linkId)).size,
      blocked: 0,
      flagged: 0,
      error: result.error,
    };
    if (result.error && feed.url) {
      log.warn({ source: feed.source, error: result.error }, "feed scan failed");
    }
    matches.push(...result.matches);
  }

  const safeBrowsing = await scanSafeBrowsing(safeBrowsingCandidates, dryRun);
  sources["safe-browsing"] = {
    entries: safeBrowsing.checked,
    matched: new Set(safeBrowsing.matches.map((m) => m.linkId)).size,
    blocked: 0,
    flagged: 0,
    error: safeBrowsing.error,
  };
  matches.push(...safeBrowsing.matches);

  const merged = mergeDecisions(matches.map((m) => decideMatch(m, index.ownHosts)));
  const existing = await loadExistingFlags(merged.map((d) => d.linkId));
  const decisions = capBlocks(withoutResolvedLinks(merged, existing), MAX_AUTO_BLOCKS_PER_RUN);

  const blocks = decisions.filter((d) => d.action === "block");
  const flags = decisions.filter((d) => d.action === "flag");
  const domains = [...new Set(blocks.flatMap((d) => (d.blockDomain ? [d.blockDomain] : [])))];

  for (const decision of decisions) {
    const summary = sources[decision.source];
    if (summary) summary[decision.action === "block" ? "blocked" : "flagged"]++;
  }

  if (!dryRun) {
    await applyDecisions(blocks, flags, domains, links);
  }

  const summary: RescanSummary = {
    dryRun,
    linksScanned: links.size,
    matched: new Set(matches.map((m) => m.linkId)).size,
    blocked: blocks.length,
    flagged: flags.length,
    skipped: merged.length - decisions.length,
    domainsBlocked: domains.length,
    sources,
    decisions: dryRun ? decisions : undefined,
  };
  log.info({ ...summary, decisions: undefined }, "phishing rescan complete");
  return summary;
}

async function scanSafeBrowsing(
  candidates: SafeBrowsingCandidate[],
  dryRun: boolean,
): Promise<{ checked: number; matches: RescanMatch[]; error?: string }> {
  if (!env.GOOGLE_SAFE_BROWSING_API_KEY) {
    return { checked: 0, matches: [], error: "not configured" };
  }

  const cursor = Number(await getStringFromCache(SAFE_BROWSING_CURSOR_KEY)) || 0;
  const { urls, nextCursor } = selectSafeBrowsingUrls(
    candidates,
    cursor,
    SAFE_BROWSING_MAX_URLS_PER_RUN,
  );

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
            entry: threats.join(", "),
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

async function loadExistingFlags(linkIds: number[]): Promise<ExistingFlag[]> {
  const rows: ExistingFlag[] = [];
  for (const ids of chunk(linkIds, WRITE_CHUNK_SIZE)) {
    rows.push(
      ...(await db
        .select({
          linkId: flaggedLink.linkId,
          status: flaggedLink.status,
          reason: flaggedLink.reason,
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
  links: Map<number, { domain: string; alias: string | null }>,
) {
  const now = new Date();

  for (const group of chunk(blocks, WRITE_CHUNK_SIZE)) {
    await db.transaction(async (tx) => {
      // Links sharing a source share a reason, so one UPDATE per source covers the group.
      const bySource = new Map<string, number[]>();
      for (const d of group) bySource.set(d.reason, [...(bySource.get(d.reason) ?? []), d.linkId]);
      for (const [reason, ids] of bySource) {
        await tx
          .update(link)
          .set({ blocked: true, blockedAt: now, blockedReason: reason })
          .where(and(inArray(link.id, ids), or(eq(link.blocked, false), isNull(link.blocked))));
      }
      await tx.insert(flaggedLink).values(
        group.map((d) => ({
          linkId: d.linkId,
          reason: d.reason,
          details: d.details,
          status: "blocked" as const,
          resolvedAt: now,
        })),
      );
    });
  }

  for (const group of chunk(flags, WRITE_CHUNK_SIZE)) {
    await db
      .insert(flaggedLink)
      .values(group.map((d) => ({ linkId: d.linkId, reason: d.reason, details: d.details })));
  }

  if (domains.length > 0) {
    const reasonByDomain = new Map(blocks.map((d) => [d.blockDomain, d.reason]));
    await db
      .insert(blockedDomain)
      .values(domains.map((domain) => ({ domain, reason: reasonByDomain.get(domain) ?? null })))
      .onDuplicateKeyUpdate({ set: { domain: sql`domain` } });
  }

  // Cached links would keep redirecting until their TTL ran out.
  await Promise.all(
    blocks.map((d) => {
      const target = links.get(d.linkId);
      return target?.alias
        ? deleteFromCache(buildCacheKey(target.domain, target.alias))
        : Promise.resolve(false);
    }),
  );
}
