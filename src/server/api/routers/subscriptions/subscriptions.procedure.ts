import { count, eq } from "drizzle-orm";

import { getPlanCaps, resolvePlan } from "@/lib/billing/plans";
import { folder, user } from "@/server/db/schema";
import { getUserPlanContext, normalizeMonthlyEventCount, normalizeMonthlyLinkCount } from "@/server/lib/user-plan";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

export const subscriptionsRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.auth.userId;

    const userRecord = await ctx.db.query.user.findFirst({
      where: (table, { eq }) => eq(table.id, user),
      with: {
        subscriptions: true,
      },
    });

    if (!userRecord) {
      throw new Error("User not found");
    }

    const planCtx = await getUserPlanContext(user, ctx.db);
    const plan = planCtx?.plan ?? resolvePlan(userRecord.subscriptions ?? null);
    const caps = getPlanCaps(plan);

    const [monthlyLinkCount, monthlyEventCount, folderCountResult] = await Promise.all([
      normalizeMonthlyLinkCount(planCtx!, ctx.db),
      normalizeMonthlyEventCount(planCtx!, ctx.db),
      ctx.db
        .select({ count: count() })
        .from(folder)
        .where(eq(folder.userId, user)),
    ]);

    const folderCount = Number(folderCountResult?.[0]?.count ?? 0);

    return {
      subscriptions: userRecord.subscriptions,
      plan,
      caps,
      usage: {
        links: {
          count: monthlyLinkCount,
          limit: caps.linksLimit ?? null,
        },
        events: {
          count: monthlyEventCount,
          limit: caps.eventsLimit ?? null,
        },
        folders: {
          count: folderCount,
          limit: caps.folderLimit ?? null,
        },
      },
      monthlyLinkCount,
    };
  }),
});
