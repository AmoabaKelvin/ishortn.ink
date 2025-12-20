import { getPlanCaps, isUnlimitedFolders, resolvePlan } from "@/lib/billing/plans";
import { folder } from "@/server/db/schema";
import { workspaceFilter } from "@/server/lib/workspace";
import { count } from "drizzle-orm";
import { createTRPCRouter, workspaceProcedure } from "../../trpc";
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
  create: workspaceProcedure
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
          .where(workspaceFilter(ctx.workspace, folder.userId, folder.teamId))
          .then((res) => res[0]?.count ?? 0);

        if (folderCount >= (caps.folderLimit ?? 0)) {
          throw new Error(
            `You have reached the limit of ${caps.folderLimit} folders for your plan. Please upgrade to add more.`
          );
        }
      }

      return createFolder(ctx, input);
    }),

  list: workspaceProcedure.query(async ({ ctx }) => {
    return listFolders(ctx);
  }),

  get: workspaceProcedure
    .input(getFolderInput)
    .query(async ({ ctx, input }) => {
      return getFolder(ctx, input);
    }),

  update: workspaceProcedure
    .input(updateFolderInput)
    .mutation(async ({ ctx, input }) => {
      return updateFolder(ctx, input);
    }),

  delete: workspaceProcedure
    .input(deleteFolderInput)
    .mutation(async ({ ctx, input }) => {
      return deleteFolder(ctx, input);
    }),

  moveLink: workspaceProcedure
    .input(moveLinkToFolderInput)
    .mutation(async ({ ctx, input }) => {
      return moveLinkToFolder(ctx, input);
    }),

  moveBulkLinks: workspaceProcedure
    .input(moveBulkLinksToFolderInput)
    .mutation(async ({ ctx, input }) => {
      return moveBulkLinksToFolder(ctx, input);
    }),

  stats: workspaceProcedure.query(async ({ ctx }) => {
    return getFolderStats(ctx);
  }),
});

export type FolderRouter = typeof folderRouter;

