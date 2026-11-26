import { and, eq, isNull, or } from "drizzle-orm";

import { buildCacheKey, deleteFromCache } from "@/lib/core/cache";
import { logger } from "@/lib/logger";
import { runBackgroundTask } from "@/lib/utils/background";
import { db } from "@/server/db";
import { flaggedLink, link, linkSafetyRecheck, user } from "@/server/db/schema";

import { checkUrlWithLlm } from "./index";

import type { SafetyAccount, SafetyAction, SafetyFollowUp, UrlSafetyResult } from "./index";
import type { WorkspaceTRPCContext } from "@/server/api/trpc";

const log = logger.child({ component: "phishing" });

/** The account a workspace's links belong to; a team is always a paying account. */
export function workspaceSafetyAccount(ctx: WorkspaceTRPCContext): SafetyAccount {
  // Looked up at most once, however many URLs a bulk import checks against this account.
  let createdAt: Promise<Date | null> | undefined;
  return {
    plan: ctx.workspace.plan,
    isTeam: ctx.workspace.type === "team",
    createdAt: () => {
      createdAt ??= ctx.db.query.user
        .findFirst({ where: eq(user.id, ctx.auth.userId), columns: { createdAt: true } })
        .then((row) => row?.createdAt ?? null);
      return createdAt;
    },
  };
}

async function writeFollowUp(linkId: number, followUp: SafetyFollowUp): Promise<void> {
  if (followUp.kind === "review") {
    await db.insert(flaggedLink).values({
      linkId,
      reason: followUp.reason,
      details: followUp.details,
      status: "pending",
    });
    return;
  }
  await db.insert(linkSafetyRecheck).values({ linkId, reason: followUp.reason });
}

/**
 * Records what `assertUrlSafe` left for later against the link it allowed: a pending FlaggedLink
 * for review, or a LinkSafetyRecheck row for the re-scan to fetch the page again. Runs after the
 * response, so it never delays link creation. `void` lets test seams that resolve to nothing
 * stand in for `assertUrlSafe`.
 */
export function recordSafetyFollowUp(linkId: number, result: UrlSafetyResult | void): void {
  const followUp = result ? result.followUp : undefined;
  if (!followUp) return;
  // Off-platform (tests, scripts) there is no waitUntil; the write still runs.
  void runBackgroundTask(writeFollowUp(linkId, followUp)).catch(() => undefined);
}

export type CreatedLink = { id: number; domain: string; alias: string };

/** Blocks the link if it is still live, records the block for review and evicts its cache entry. */
async function blockLink(created: CreatedLink, reason: string, details: string): Promise<void> {
  const now = new Date();
  const blocked = await db.transaction(async (tx) => {
    // Conditional, so a link the campaign-pattern check blocked meanwhile gets no second row.
    const [result] = await tx
      .update(link)
      .set({ blocked: true, blockedAt: now, blockedReason: reason })
      .where(and(eq(link.id, created.id), or(eq(link.blocked, false), isNull(link.blocked))));
    if (result.affectedRows === 0) return false;
    await tx
      .insert(flaggedLink)
      .values({ linkId: created.id, reason, details, status: "blocked", resolvedAt: now });
    return true;
  });
  // A cached link would keep redirecting until its TTL ran out.
  if (blocked) await deleteFromCache(buildCacheKey(created.domain, created.alias));
}

async function applySafetyAction(
  created: CreatedLink,
  action: SafetyAction | undefined,
): Promise<void> {
  if (!action) return;
  if (action.kind === "block") return blockLink(created, action.reason, action.details);
  await writeFollowUp(created.id, action);
}

/**
 * Runs the page rules and the LLM check (`checkUrlWithLlm`) on a link just created, after the
 * response, and blocks, flags or queues a re-check for it. Resolves once that is done, so tests
 * can wait for it; callers don't.
 */
export function checkUrlWithLlmAfterResponse(
  created: CreatedLink,
  url: string,
  options: Parameters<typeof checkUrlWithLlm>[1],
): Promise<void> {
  const task = checkUrlWithLlm(url, options)
    .then((action) => applySafetyAction(created, action))
    .catch((err) => {
      log.error({ err, linkId: created.id }, "after-response URL safety check failed");
    });
  // Off-platform (tests, scripts) there is no waitUntil; the task still runs.
  void runBackgroundTask(task).catch(() => undefined);
  return task;
}
