import { count } from "drizzle-orm";
import { z } from "zod";

import { getPlanCaps, isUnlimitedDomains, resolvePlan } from "@/lib/billing/plans";
import { createTRPCRouter, contentWriteProcedure, workspaceProcedure } from "@/server/api/trpc";
import { customDomain } from "@/server/db/schema";
import { workspaceFilter } from "@/server/lib/workspace";

import * as input from "./domains.input";
import * as services from "./domains.service";

export const customDomainRouter = createTRPCRouter({
  create: contentWriteProcedure
    .input(input.createCustomDomainSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.query.user.findFirst({
        where: (table, { eq }) => eq(table.id, ctx.auth.userId),
        with: { subscriptions: true },
      });

      const plan = resolvePlan(user?.subscriptions);

      if (!isUnlimitedDomains(plan)) {
        const caps = getPlanCaps(plan);
        const domainCount = await ctx.db
          .select({ count: count() })
          .from(customDomain)
          .where(workspaceFilter(ctx.workspace, customDomain.userId, customDomain.teamId))
          .then((res) => res[0]?.count ?? 0);

        if (domainCount >= (caps.domainLimit ?? 0)) {
          throw new Error(
            `You have reached the limit of ${caps.domainLimit} custom domains for your plan. Please upgrade to add more.`,
          );
        }
      }

      return services.addDomainToUserAccount(ctx, input);
    }),

  list: workspaceProcedure.query(async ({ ctx }) => {
    return services.getCustomDomainsForUser(ctx);
  }),

  delete: workspaceProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return services.deleteDomainAndAssociatedLinks(ctx, input.id);
    }),

  getStats: workspaceProcedure
    .input(z.object({ domain: z.string() }))
    .query(async ({ ctx, input }) => {
      return services.getDomainStatistics(ctx, input.domain);
    }),

  migrationStatus: workspaceProcedure.query(({ ctx }) => services.getDomainsNeedingMigration(ctx)),

  checkStatus: workspaceProcedure
    .input(z.object({ domain: z.string().max(255) }))
    .query(({ ctx, input }) => services.checkDomainStatus(ctx, input.domain)),
});
