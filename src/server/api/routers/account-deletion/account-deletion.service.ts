import { cancelSubscription } from "@lemonsqueezy/lemonsqueezy.js";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull, or } from "drizzle-orm";

import { DELETION_CASCADE_REASON, purgeDateFor } from "@/lib/account-deletion/constants";
import { isSubscriptionEntitled, resolvePlan } from "@/lib/billing/plans";
import { configureLemonSqueezy } from "@/lib/config/lemonsqueezy";
import { buildCacheKey, deleteFromCache } from "@/lib/core/cache";
import { logger } from "@/lib/logger";
import { runBackgroundTask } from "@/lib/utils/background";
import {
  accountDeletion,
  accountTransfer,
  link,
  subscription,
  team,
  user,
} from "@/server/db/schema";
import { sendAccountDeletionEmail } from "@/server/lib/notifications/account-deletion";
import { sendAccountDeletionNotification } from "@/server/lib/notifications/discord";

import type { ProtectedTRPCContext } from "../../trpc";
import type { RequestAccountDeletionInput } from "./account-deletion.input";

const log = logger.child({ component: "account-deletion" });

export async function getDeletionStatus(ctx: ProtectedTRPCContext) {
  const [record, teams] = await Promise.all([
    ctx.db.query.user.findFirst({
      where: eq(user.id, ctx.auth.userId),
      columns: { deletedAt: true, email: true },
    }),
    ctx.db.query.team.findMany({
      where: and(eq(team.ownerId, ctx.auth.userId), isNull(team.deletedAt)),
      columns: { name: true },
    }),
  ]);

  const deletedAt = record?.deletedAt ?? null;

  return {
    email: record?.email ?? null,
    deletedAt,
    purgeAt: deletedAt ? purgeDateFor(deletedAt) : null,
    ownedTeams: teams,
  };
}

/**
 * Soft-delete the account: record the exit survey, stamp user.deletedAt, and
 * cascade-block the user's personal links so they stop resolving immediately.
 * Everything is reversible until the purge job runs.
 */
export async function requestAccountDeletion(
  ctx: ProtectedTRPCContext,
  input: RequestAccountDeletionInput,
) {
  const userId = ctx.auth.userId;

  const currentUser = await ctx.db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { email: true, name: true, deletedAt: true },
    with: { subscriptions: true },
  });

  if (!currentUser) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
  }

  if (currentUser.deletedAt) {
    return { deletedAt: currentUser.deletedAt, purgeAt: purgeDateFor(currentUser.deletedAt) };
  }

  if (currentUser.email?.trim().toLowerCase() !== input.confirmEmail.toLowerCase()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The email you typed doesn't match this account",
    });
  }

  // Owned teams block deletion — members would silently lose the workspace.
  const ownedTeams = await ctx.db.query.team.findMany({
    where: and(eq(team.ownerId, userId), isNull(team.deletedAt)),
    columns: { name: true },
  });

  if (ownedTeams.length > 0) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Delete or transfer your teams first: ${ownedTeams.map((t) => t.name).join(", ")}`,
    });
  }

  const pendingTransfer = await ctx.db.query.accountTransfer.findFirst({
    where: and(eq(accountTransfer.fromUserId, userId), eq(accountTransfer.status, "pending")),
    columns: { id: true },
  });

  if (pendingTransfer) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Cancel your pending account transfer before deleting your account",
    });
  }

  const userSubscription = currentUser.subscriptions;
  const planSnapshot = resolvePlan(userSubscription);

  // Cancel billing first: if this fails we abort, so nobody keeps paying for an
  // account they can no longer reach. A subscription the user already cancelled
  // stays entitled until endsAt — cancelling it twice just makes Lemon Squeezy
  // error and locks them out of deleting.
  const alreadyCancelled = userSubscription?.status === "cancelled";

  if (
    userSubscription?.subscriptionId &&
    !alreadyCancelled &&
    isSubscriptionEntitled(userSubscription)
  ) {
    configureLemonSqueezy();
    const cancelled = await cancelSubscription(userSubscription.subscriptionId);

    if (cancelled.error) {
      log.error({ err: cancelled.error, userId }, "failed to cancel subscription before deletion");
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "We couldn't cancel your subscription, so your account was not deleted. Please try again or contact support@ishortn.ink.",
      });
    }

    await ctx.db
      .update(subscription)
      .set({
        status: cancelled.data?.data.attributes.status,
        endsAt: cancelled.data?.data.attributes.ends_at
          ? new Date(cancelled.data.data.attributes.ends_at)
          : null,
      })
      .where(eq(subscription.userId, userId));
  }

  // Personal links only — team links belong to the team, not the leaving user.
  // Skip links that are already blocked: overwriting an abuse block with our
  // sentinel would hand the link back on restore.
  const cascadeTarget = and(
    eq(link.userId, userId),
    isNull(link.teamId),
    or(isNull(link.blocked), eq(link.blocked, false)),
  );

  const linksToBlock = await ctx.db
    .select({ alias: link.alias, domain: link.domain })
    .from(link)
    .where(cascadeTarget);
  const deletedAt = new Date();

  await ctx.db.transaction(async (tx) => {
    await tx.update(user).set({ deletedAt }).where(eq(user.id, userId));

    if (linksToBlock.length > 0) {
      await tx
        .update(link)
        .set({ blocked: true, blockedAt: deletedAt, blockedReason: DELETION_CASCADE_REASON })
        .where(cascadeTarget);
    }

    const survey = {
      userId,
      email: currentUser.email,
      reason: input.reason,
      destination: input.destination ?? null,
      improvement: input.improvement || null,
      planSnapshot,
      requestedAt: deletedAt,
      restoredAt: null,
    };

    await tx.insert(accountDeletion).values(survey).onDuplicateKeyUpdate({ set: survey });
  });

  // Cache holds resolved links; blocked rows only take effect once it's purged.
  await Promise.all(linksToBlock.map((l) => deleteFromCache(buildCacheKey(l.domain, l.alias!))));

  const purgeAt = purgeDateFor(deletedAt);

  void runBackgroundTask(
    Promise.all([
      sendAccountDeletionEmail({
        toEmail: currentUser.email,
        toName: currentUser.name,
        purgeAt,
      }),
      sendAccountDeletionNotification({
        userEmail: currentUser.email ?? "unknown",
        userName: currentUser.name,
        planSnapshot,
        reason: input.reason,
        destination: input.destination ?? null,
        improvement: input.improvement || null,
        linksAffected: linksToBlock.length,
      }),
    ]),
  );

  log.info({ userId, planSnapshot, links: linksToBlock.length }, "account soft-deleted");

  return { deletedAt, purgeAt };
}

/** Undo a soft delete inside the grace period. */
export async function restoreAccount(ctx: ProtectedTRPCContext) {
  const userId = ctx.auth.userId;

  const currentUser = await ctx.db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { deletedAt: true },
  });

  if (!currentUser?.deletedAt) {
    return { restored: false };
  }

  // Only the links this cascade blocked — anything blocked for abuse stays blocked.
  const blockedLinks = await ctx.db
    .select({ alias: link.alias, domain: link.domain })
    .from(link)
    .where(and(eq(link.userId, userId), eq(link.blockedReason, DELETION_CASCADE_REASON)));

  await ctx.db.transaction(async (tx) => {
    await tx.update(user).set({ deletedAt: null }).where(eq(user.id, userId));

    if (blockedLinks.length > 0) {
      await tx
        .update(link)
        .set({ blocked: false, blockedAt: null, blockedReason: null })
        .where(and(eq(link.userId, userId), eq(link.blockedReason, DELETION_CASCADE_REASON)));
    }

    await tx
      .update(accountDeletion)
      .set({ restoredAt: new Date() })
      .where(eq(accountDeletion.userId, userId));
  });

  await Promise.all(blockedLinks.map((l) => deleteFromCache(buildCacheKey(l.domain, l.alias!))));

  log.info({ userId, links: blockedLinks.length }, "account restored");

  return { restored: true };
}
