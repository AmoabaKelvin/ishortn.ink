import { createTRPCRouter, contentWriteProcedure, workspaceProcedure } from "@/server/api/trpc";

import {
  createGeoRuleSchema,
  deleteGeoRuleSchema,
  getGeoRulesByLinkSchema,
  reorderGeoRulesSchema,
  updateGeoRuleSchema,
} from "./geo-rules.input";
import {
  createGeoRule,
  deleteGeoRule,
  getGeoRulesByLinkId,
  reorderGeoRules,
  updateGeoRule,
} from "./geo-rules.service";

export const geoRulesRouter = createTRPCRouter({
  // Get all geo rules for a link
  getByLinkId: workspaceProcedure.input(getGeoRulesByLinkSchema).query(async ({ ctx, input }) => {
    return getGeoRulesByLinkId(ctx, input);
  }),

  // Create a new geo rule
  create: contentWriteProcedure.input(createGeoRuleSchema).mutation(async ({ ctx, input }) => {
    return createGeoRule(ctx, input);
  }),

  // Update an existing geo rule
  update: contentWriteProcedure.input(updateGeoRuleSchema).mutation(async ({ ctx, input }) => {
    return updateGeoRule(ctx, input);
  }),

  // Delete a geo rule
  delete: contentWriteProcedure.input(deleteGeoRuleSchema).mutation(async ({ ctx, input }) => {
    return deleteGeoRule(ctx, input);
  }),

  // Reorder geo rules
  reorder: contentWriteProcedure.input(reorderGeoRulesSchema).mutation(async ({ ctx, input }) => {
    return reorderGeoRules(ctx, input);
  }),
});
