import { and, count, eq, gt, inArray, isNull, or } from "drizzle-orm";

import {
  effectivePlan,
  FEATURE_LABELS,
  higherPlan,
  isGraceActive,
  overPlanFeatures,
  paidPlan,
  teamAccess,
} from "@/lib/billing/entitlements";
import { subscription, team, teamMember, user } from "@/server/db/schema";

import { getPlanUsageByUser } from "./usage";

import type { OverPlanFeature, UsageFeature } from "@/lib/billing/entitlements";
import type { Plan } from "@/lib/billing/plans";
import type { DbClient } from "@/server/lib/user-plan";

const LOOKUP_CHUNK = 1000;
const ACCOUNT_ROWS = 200;

export type OverPlanAccount = {
  userId: string;
  name: string | null;
  email: string | null;
  paidPlan: Plan;
  effectivePlan: Plan;
  requiredPlan: Plan;
  features: OverPlanFeature[];
  graceEndsAt: Date | null;
  graceActive: boolean;
};

export type OverPlanTeam = {
  teamId: number;
  name: string;
  slug: string;
  ownerEmail: string | null;
  ownerPlan: Plan;
  members: number;
  graceEndsAt: Date | null;
  readOnly: boolean;
};

/**
 * Accounts using features above their live (paid) plan, and teams whose owner
 * isn't on Ultra, for the admin entitlements page. The account list is capped;
 * `totalAccounts` and `featureCounts` cover every account.
 */
export async function getEntitlementOverview(dbClient: DbClient, now = new Date()) {
  const usage = await getPlanUsageByUser(dbClient, undefined, now);

  // Paid plans come from the live subscriptions (a row per paying customer), so
  // only accounts actually over their plan are looked up below.
  const paying = await dbClient
    .select({
      userId: subscription.userId,
      status: subscription.status,
      endsAt: subscription.endsAt,
      variantId: subscription.variantId,
      productId: subscription.productId,
      plan: subscription.plan,
    })
    .from(subscription)
    .where(
      or(
        inArray(subscription.status, ["active", "on_trial"]),
        and(eq(subscription.status, "cancelled"), gt(subscription.endsAt, now)),
      ),
    );
  const paidByUser = new Map(paying.map((row) => [row.userId, paidPlan(row, now)]));
  const overByUser = new Map<string, { paid: Plan; features: OverPlanFeature[] }>();
  for (const [userId, used] of usage) {
    const paid = paidByUser.get(userId) ?? "free";
    const features = overPlanFeatures(used, paid);
    if (features.length > 0) overByUser.set(userId, { paid, features });
  }

  const accounts: OverPlanAccount[] = [];
  const ids = [...overByUser.keys()];
  for (let i = 0; i < ids.length; i += LOOKUP_CHUNK) {
    const rows = await dbClient.query.user.findMany({
      where: inArray(user.id, ids.slice(i, i + LOOKUP_CHUNK)),
      columns: {
        id: true,
        name: true,
        email: true,
        deletedAt: true,
        planGracePlan: true,
        planGraceEndsAt: true,
      },
      with: { subscriptions: true },
    });
    for (const row of rows) {
      const over = overByUser.get(row.id);
      if (row.deletedAt || !over) continue;
      accounts.push({
        userId: row.id,
        name: row.name,
        email: row.email,
        paidPlan: over.paid,
        effectivePlan: effectivePlan(row.subscriptions, row, now),
        requiredPlan: over.features.reduce<Plan>(
          (plan, item) => higherPlan(plan, item.requiredPlan),
          "free",
        ),
        features: over.features,
        graceEndsAt: row.planGraceEndsAt,
        graceActive: isGraceActive(row.planGraceEndsAt, now),
      });
    }
  }

  const featureTotals = new Map<UsageFeature, number>();
  for (const account of accounts) {
    for (const item of account.features) {
      featureTotals.set(item.feature, (featureTotals.get(item.feature) ?? 0) + 1);
    }
  }
  const featureCounts = [...featureTotals.entries()]
    .map(([feature, total]) => ({ feature, label: FEATURE_LABELS[feature], accounts: total }))
    .sort((a, b) => b.accounts - a.accounts);

  accounts.sort(
    (a, b) => b.features.length - a.features.length || (a.email ?? "").localeCompare(b.email ?? ""),
  );

  const teamRows = await dbClient
    .select({
      teamId: team.id,
      name: team.name,
      slug: team.slug,
      graceEndsAt: team.ownerPlanGraceEndsAt,
      ownerEmail: user.email,
      planGracePlan: user.planGracePlan,
      planGraceEndsAt: user.planGraceEndsAt,
      sub: subscription,
    })
    .from(team)
    .innerJoin(user, eq(user.id, team.ownerId))
    .leftJoin(subscription, eq(subscription.userId, team.ownerId))
    .where(isNull(team.deletedAt));

  const belowUltra = teamRows.filter((row) => paidPlan(row.sub, now) !== "ultra");
  const memberCounts =
    belowUltra.length === 0
      ? []
      : await dbClient
          .select({ teamId: teamMember.teamId, total: count() })
          .from(teamMember)
          .where(
            inArray(
              teamMember.teamId,
              belowUltra.map((row) => row.teamId),
            ),
          )
          .groupBy(teamMember.teamId);
  const membersByTeam = new Map(memberCounts.map((row) => [row.teamId, row.total]));

  const teams: OverPlanTeam[] = belowUltra.map((row) => {
    const ownerPlan = effectivePlan(row.sub, row, now);
    return {
      teamId: row.teamId,
      name: row.name,
      slug: row.slug,
      ownerEmail: row.ownerEmail,
      ownerPlan,
      members: membersByTeam.get(row.teamId) ?? 0,
      graceEndsAt: row.graceEndsAt,
      readOnly: teamAccess(ownerPlan, row.graceEndsAt, now).readOnly,
    };
  });

  return {
    totalAccounts: accounts.length,
    accounts: accounts.slice(0, ACCOUNT_ROWS),
    featureCounts,
    teams,
  };
}
