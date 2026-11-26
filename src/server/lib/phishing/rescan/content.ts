import { and, asc, eq, gt, inArray, isNull, lt, lte, or } from "drizzle-orm";

import { detectPhishingLink } from "@/server/api/routers/ai/ai.service";
import { db } from "@/server/db";
import { link, linkSafetyRecheck, user } from "@/server/db/schema";
import { BROWSER_USER_AGENT, scrapePageForSafetyCheck } from "@/server/lib/metadata";

import { loadPayingLinkIds } from "./accounts";
import {
  CONTENT_CHECK_DELAYS_MS,
  CONTENT_WINDOW_MS,
  checksDueBy,
  isContentCheckDue,
  NEW_ACCOUNT_MS,
  pageSignalCheck,
  selectsForContentCheck,
} from "./content-utils";

import type { ContentCheck } from "./content-utils";
import type { ScrapedPage } from "@/server/lib/metadata";

// Each check is a page fetch (plus its redirects) and usually an LLM call. 100 per 15-minute run
// keeps a run to a few minutes and well inside the Worker's subrequest limit, and still allows
// 9,600 checks a day.
export const MAX_CONTENT_CHECKS_PER_RUN = 100;
const CONTENT_CHECK_CONCURRENCY = 8;
// New-account links enrolled per run. Each needs one row, so this bounds the insert; the rest
// are enrolled by the next run.
const MAX_ENROL_PER_RUN = 1_000;
// A run takes its links by stamping lastCheckedAt; a run that died frees them after this.
const CLAIM_MS = 30 * 60 * 1000;

export type ContentCheckDeps = {
  scrape?: (url: string) => Promise<ScrapedPage>;
  detect?: typeof detectPhishingLink;
};

type ContentTarget = { linkId: number; url: string; linkCreatedAt: Date };
export type ContentResult = ContentTarget & { check: ContentCheck };

/**
 * Fetches the destination as a desktop browser would (crawler user agents get the harmless page
 * cloaking kits keep for them) and runs the creation check's page rules, then the LLM.
 */
export async function checkLinkContent(
  url: string,
  {
    scrape = (target) => scrapePageForSafetyCheck(target, BROWSER_USER_AGENT),
    detect = detectPhishingLink,
  }: ContentCheckDeps = {},
): Promise<ContentCheck> {
  let page: ScrapedPage;
  try {
    page = await scrape(url);
  } catch (error) {
    return { kind: "error", error: error instanceof Error ? error.message : String(error) };
  }
  const signal = pageSignalCheck(url, page.signals);
  if (signal) return signal;

  try {
    const verdict = await detect(url, page.metadata, page.signals);
    if (!verdict.phishing) return { kind: "clean" };
    return { kind: "phishing", details: `LLM flagged the page at ${page.signals.finalUrl}` };
  } catch (error) {
    return { kind: "error", error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Re-checks the content of the links that are due (see `selectsForContentCheck` and
 * `CONTENT_CHECK_DELAYS_MS`), at most `MAX_CONTENT_CHECKS_PER_RUN`. Outside a dry run the links
 * are taken for this run first, and `recordContentProgress` must be called with the results.
 */
export async function scanLinkContent({
  dryRun,
  now,
  deps,
}: {
  dryRun: boolean;
  now: Date;
  deps?: ContentCheckDeps;
}): Promise<ContentResult[]> {
  // A dry run enrols nothing, so the links it would enrol are considered directly.
  const unenrolled = await enrolNewAccountLinks(now, dryRun);
  const due = await loadDueLinks(now, MAX_CONTENT_CHECKS_PER_RUN);
  const byLink = new Map<number, ContentTarget>();
  const fresh = unenrolled.filter((t) => isContentCheckDue(t.linkCreatedAt, 0, now));
  for (const target of [...due, ...fresh]) {
    if (!byLink.has(target.linkId)) byLink.set(target.linkId, target);
  }
  // A link can have two rows (unverified at creation, then enrolled as new) but is checked once.
  let targets = [...byLink.values()].slice(0, MAX_CONTENT_CHECKS_PER_RUN);
  if (targets.length === 0) return [];
  if (!dryRun) targets = await claimTargets(targets, now);

  const results: ContentResult[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONTENT_CHECK_CONCURRENCY, targets.length) }, async () => {
      while (next < targets.length) {
        const target = targets[next++]!;
        results.push({ ...target, check: await checkLinkContent(target.url, deps) });
      }
    }),
  );
  return results;
}

/**
 * Takes the targets' rows for this run and keeps the links it got: the UPDATE only takes rows no
 * other live run holds, and the run's token in `result` (until `recordContentProgress` replaces
 * it) tells which rows those were, so overlapping runs never fetch the same link.
 */
async function claimTargets(targets: ContentTarget[], now: Date): Promise<ContentTarget[]> {
  const token = `claim:${crypto.randomUUID().slice(0, 10)}`;
  const linkIds = targets.map((t) => t.linkId);
  await db
    .update(linkSafetyRecheck)
    .set({ lastCheckedAt: now, result: token })
    .where(
      and(
        inArray(linkSafetyRecheck.linkId, linkIds),
        or(
          isNull(linkSafetyRecheck.lastCheckedAt),
          lt(linkSafetyRecheck.lastCheckedAt, new Date(now.getTime() - CLAIM_MS)),
        ),
      ),
    );
  const claimed = await db
    .select({ linkId: linkSafetyRecheck.linkId })
    .from(linkSafetyRecheck)
    .where(and(inArray(linkSafetyRecheck.linkId, linkIds), eq(linkSafetyRecheck.result, token)));
  const claimedIds = new Set(claimed.map((row) => row.linkId));
  return targets.filter((t) => claimedIds.has(t.linkId));
}

/**
 * Adds a LinkSafetyRecheck row for each new link of a new personal account that has none yet.
 * Links the selection leaves out (paying owner, well-known host) get a finished row, so they
 * aren't looked at again. In a dry run nothing is written and the selected links are returned.
 */
async function enrolNewAccountLinks(now: Date, dryRun: boolean): Promise<ContentTarget[]> {
  const rows = await db
    .select({
      id: link.id,
      url: link.url,
      createdAt: link.createdAt,
      blocked: link.blocked,
      teamId: link.teamId,
      ownerCreatedAt: user.createdAt,
    })
    .from(link)
    .innerJoin(user, eq(user.id, link.userId))
    .leftJoin(linkSafetyRecheck, eq(linkSafetyRecheck.linkId, link.id))
    .where(
      and(
        gt(link.createdAt, new Date(now.getTime() - CONTENT_WINDOW_MS)),
        isNull(link.teamId),
        or(eq(link.blocked, false), isNull(link.blocked)),
        gt(user.createdAt, new Date(now.getTime() - NEW_ACCOUNT_MS)),
        isNull(linkSafetyRecheck.id),
      ),
    )
    .orderBy(asc(link.id))
    .limit(MAX_ENROL_PER_RUN);
  if (rows.length === 0) return [];

  const paying = await loadPayingLinkIds(rows.map((row) => row.id));
  const selected = rows.filter((row) =>
    selectsForContentCheck(
      { ...row, paying: paying.has(row.id), unverifiedAtCreation: false },
      now,
    ),
  );
  if (dryRun) {
    return selected.flatMap((row) =>
      row.url && row.createdAt
        ? [{ linkId: row.id, url: row.url, linkCreatedAt: row.createdAt }]
        : [],
    );
  }

  const selectedIds = new Set(selected.map((row) => row.id));
  const finished = { checksDone: CONTENT_CHECK_DELAYS_MS.length, result: "skipped" };
  await db.insert(linkSafetyRecheck).values(
    rows.map((row) => ({
      linkId: row.id,
      reason: "new-account",
      ...(!selectedIds.has(row.id) && finished),
    })),
  );
  return [];
}

/** Live links with a LinkSafetyRecheck row that have reached a check time they haven't had. */
async function loadDueLinks(now: Date, limit: number): Promise<ContentTarget[]> {
  const since = new Date(now.getTime() - CONTENT_WINDOW_MS);
  const rows = await db
    .select({ linkId: link.id, url: link.url, createdAt: link.createdAt })
    .from(linkSafetyRecheck)
    .innerJoin(link, eq(link.id, linkSafetyRecheck.linkId))
    .where(
      and(
        // Rows are written once the link exists, so this only narrows the scan to the index.
        gt(linkSafetyRecheck.createdAt, since),
        gt(link.createdAt, since),
        or(eq(link.blocked, false), isNull(link.blocked)),
        or(
          isNull(linkSafetyRecheck.lastCheckedAt),
          lt(linkSafetyRecheck.lastCheckedAt, new Date(now.getTime() - CLAIM_MS)),
        ),
        or(
          ...CONTENT_CHECK_DELAYS_MS.map((delay, checksDone) =>
            and(
              eq(linkSafetyRecheck.checksDone, checksDone),
              lte(link.createdAt, new Date(now.getTime() - delay)),
            ),
          ),
        ),
      ),
    )
    .orderBy(asc(linkSafetyRecheck.id))
    .limit(limit);
  return rows.flatMap((row) =>
    row.url && row.createdAt
      ? [{ linkId: row.linkId, url: row.url, linkCreatedAt: row.createdAt }]
      : [],
  );
}

/**
 * Stores each checked link's progress: the checks its age called for are done, whatever the
 * outcome, so a run never repeats one. One UPDATE per (checks done, outcome) pair.
 */
export async function recordContentProgress(results: ContentResult[], now: Date): Promise<void> {
  const groups = new Map<string, { checksDone: number; result: string; linkIds: number[] }>();
  for (const r of results) {
    const checksDone = checksDueBy(r.linkCreatedAt, now);
    const key = `${checksDone}:${r.check.kind}`;
    const group = groups.get(key) ?? { checksDone, result: r.check.kind, linkIds: [] };
    group.linkIds.push(r.linkId);
    groups.set(key, group);
  }
  for (const { checksDone, result, linkIds } of groups.values()) {
    await db
      .update(linkSafetyRecheck)
      .set({ checksDone, result, lastCheckedAt: now })
      .where(inArray(linkSafetyRecheck.linkId, linkIds));
  }
}
