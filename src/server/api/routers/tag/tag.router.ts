import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

import {
  associateTagsWithLink,
  createTag,
  getLinksByTag,
  getTagsForLink,
  getUserTags,
} from "./tag.service";

export const tagRouter = createTRPCRouter({
  // Get all tags for the current user
  list: protectedProcedure.query(async ({ ctx }) => {
    return getUserTags(ctx);
  }),

  // Create a new tag
  create: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return createTag(ctx, input.name);
    }),

  // Get tags for a specific link
  getForLink: protectedProcedure
    .input(z.object({ linkId: z.number() }))
    .query(async ({ ctx, input }) => {
      return getTagsForLink(ctx, input.linkId);
    }),

  // Associate tags with a link
  associateWithLink: protectedProcedure
    .input(
      z.object({
        linkId: z.number(),
        tagNames: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await associateTagsWithLink(ctx, input.linkId, input.tagNames);
      return { success: true };
    }),

  // Get links by tag
  getLinksByTag: protectedProcedure
    .input(z.object({ tagName: z.string() }))
    .query(async ({ ctx, input }) => {
      return getLinksByTag(ctx, input.tagName);
    }),
});
