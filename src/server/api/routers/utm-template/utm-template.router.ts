import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

import {
  createUtmTemplateInput,
  deleteUtmTemplateInput,
  getUtmTemplateInput,
  updateUtmTemplateInput,
} from "./utm-template.input";
import {
  createUtmTemplate,
  deleteUtmTemplate,
  getUtmTemplateById,
  getUserUtmTemplates,
  updateUtmTemplate,
} from "./utm-template.service";

export const utmTemplateRouter = createTRPCRouter({
  // Get all UTM templates for the current user
  list: protectedProcedure.query(async ({ ctx }) => {
    return getUserUtmTemplates(ctx);
  }),

  // Get a single UTM template by ID
  get: protectedProcedure
    .input(getUtmTemplateInput)
    .query(async ({ ctx, input }) => {
      return getUtmTemplateById(ctx, input.id);
    }),

  // Create a new UTM template
  create: protectedProcedure
    .input(createUtmTemplateInput)
    .mutation(async ({ ctx, input }) => {
      return createUtmTemplate(ctx, input);
    }),

  // Update an existing UTM template
  update: protectedProcedure
    .input(updateUtmTemplateInput)
    .mutation(async ({ ctx, input }) => {
      return updateUtmTemplate(ctx, input);
    }),

  // Delete a UTM template
  delete: protectedProcedure
    .input(deleteUtmTemplateInput)
    .mutation(async ({ ctx, input }) => {
      return deleteUtmTemplate(ctx, input.id);
    }),
});
