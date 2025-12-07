import { getPlanCaps, isUnlimitedFolders, resolvePlan } from "@/lib/billing/plans";
import { folder } from "@/server/db/schema";
import { count, eq } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "../../trpc";
import {
    createFolderInput,
    deleteFolderInput,
    getFolderInput,
    moveBulkLinksToFolderInput,
    moveLinkToFolderInput,
    updateFolderInput,
} from "./folder.input";
import {
    createFolder,
    deleteFolder,
    getFolder,
    getFolderStats,
    listFolders,
    moveBulkLinksToFolder,
    moveLinkToFolder,
    updateFolder,
} from "./folder.service";

export const folderRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createFolderInput)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.query.user.findFirst({
        where: (table, { eq }) => eq(table.id, ctx.auth.userId),
        with: { subscriptions: true },
      });

      const plan = resolvePlan(user?.subscriptions);

      if (!isUnlimitedFolders(plan)) {
        const caps = getPlanCaps(plan);
        const folderCount = await ctx.db
          .select({ count: count() })
          .from(folder)
          .where(eq(folder.userId, ctx.auth.userId))
          .then((res) => res[0]?.count ?? 0);

        if (folderCount >= (caps.folderLimit ?? 0)) {
          throw new Error(
            `You have reached the limit of ${caps.folderLimit} folders for your plan. Please upgrade to add more.`
          );
        }
      }

      return createFolder(ctx, input);
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return listFolders(ctx);
  }),

  get: protectedProcedure
    .input(getFolderInput)
    .query(async ({ ctx, input }) => {
      return getFolder(ctx, input);
    }),

  update: protectedProcedure
    .input(updateFolderInput)
    .mutation(async ({ ctx, input }) => {
      return updateFolder(ctx, input);
    }),

  delete: protectedProcedure
    .input(deleteFolderInput)
    .mutation(async ({ ctx, input }) => {
      return deleteFolder(ctx, input);
    }),

  moveLink: protectedProcedure
    .input(moveLinkToFolderInput)
    .mutation(async ({ ctx, input }) => {
      return moveLinkToFolder(ctx, input);
    }),

  moveBulkLinks: protectedProcedure
    .input(moveBulkLinksToFolderInput)
    .mutation(async ({ ctx, input }) => {
      return moveBulkLinksToFolder(ctx, input);
    }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    return getFolderStats(ctx);
  }),
});

export type FolderRouter = typeof folderRouter;

