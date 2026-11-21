import { z } from "zod";

import { createTRPCRouter, contentWriteProcedure, workspaceProcedure } from "@/server/api/trpc";

import * as input from "./domains.input";
import * as services from "./domains.service";

export const customDomainRouter = createTRPCRouter({
  create: contentWriteProcedure
    .input(input.createCustomDomainSchema)
    .mutation(async ({ ctx, input }) => {
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
