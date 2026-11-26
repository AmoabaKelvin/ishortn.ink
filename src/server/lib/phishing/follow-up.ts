import { eq } from "drizzle-orm";

import { runBackgroundTask } from "@/lib/utils/background";
import { db } from "@/server/db";
import { flaggedLink, linkSafetyRecheck, user } from "@/server/db/schema";

import type { SafetyAccount, UrlSafetyResult } from "./index";
import type { WorkspaceTRPCContext } from "@/server/api/trpc";

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

/**
 * Records what `assertUrlSafe` left for later against the link it allowed: a pending FlaggedLink
 * for review, or a LinkSafetyRecheck row for the re-scan to fetch the page again. Runs after the
 * response, so it never delays link creation. `void` lets test seams that resolve to nothing
 * stand in for `assertUrlSafe`.
 */
export function recordSafetyFollowUp(linkId: number, result: UrlSafetyResult | void): void {
  const followUp = result ? result.followUp : undefined;
  if (!followUp) return;

  // `execute()` starts the query now; a bare query builder only runs once awaited.
  const write =
    followUp.kind === "review"
      ? db
          .insert(flaggedLink)
          .values({
            linkId,
            reason: followUp.reason,
            details: followUp.details,
            status: "pending",
          })
          .execute()
      : db.insert(linkSafetyRecheck).values({ linkId, reason: followUp.reason }).execute();

  // Off-platform (tests, scripts) there is no waitUntil; the write still runs.
  void runBackgroundTask(write).catch(() => undefined);
}
