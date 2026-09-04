import { z } from "zod";

import { createTRPCRouter, workspaceProcedure } from "@/server/api/trpc";

import { verifyLinkOwnership } from "../link/utils";
import {
  associateTagsWithLink,
  createTag,
  getLinksByTag,
  getTagsForLink,
  getUserTags,
} from "./tag.service";

export const tagRouter = createTRPCRouter({
  // Get all tags for the current workspace
  list: workspaceProcedure.query(async ({ ctx }) => {
    return getUserTags(ctx);
  }),

  // Create a new tag
  create: workspaceProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return createTag(ctx, input.name);
    }),

  // Get tags for a specific link
  getForLink: workspaceProcedure
    .input(z.object({ linkId: z.number() }))
    .query(async ({ ctx, input }) => {
      // Workspace scoping happens in the service; this also enforces folder
      // restrictions, which team members must not read around.
      await verifyLinkOwnership(ctx, input.linkId);
      return getTagsForLink(ctx, input.linkId);
    }),

  // Associate tags with a link
  associateWithLink: workspaceProcedure
    .input(
      z.object({
        linkId: z.number(),
        tagNames: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifyLinkOwnership(ctx, input.linkId);
      await associateTagsWithLink(ctx, input.linkId, input.tagNames);
      return { success: true };
    }),

  // Get links by tag
  getLinksByTag: workspaceProcedure
    .input(z.object({ tagName: z.string() }))
    .query(async ({ ctx, input }) => {
      return getLinksByTag(ctx, input.tagName);
    }),
});
