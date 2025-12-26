import { createTRPCRouter, workspaceProcedure } from "../../trpc";
import {
    createFolderInput,
    deleteFolderInput,
    getFolderInput,
    getFolderPermissionsInput,
    moveBulkLinksToFolderInput,
    moveLinkToFolderInput,
    updateFolderInput,
    updateFolderPermissionsInput,
} from "./folder.input";
import {
    createFolder,
    deleteFolder,
    getFolder,
    getFolderPermissions,
    getFolderStats,
    listFolders,
    moveBulkLinksToFolder,
    moveLinkToFolder,
    updateFolder,
    updateFolderPermissions,
} from "./folder.service";

export const folderRouter = createTRPCRouter({
  create: workspaceProcedure
    .input(createFolderInput)
    .mutation(async ({ ctx, input }) => {
      // Folder limit check is done atomically in createFolder via transaction
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

  // Folder permission management endpoints (team only, admin/owner only)
  getPermissions: workspaceProcedure
    .input(getFolderPermissionsInput)
    .query(async ({ ctx, input }) => {
      return getFolderPermissions(ctx, input);
    }),

  updatePermissions: workspaceProcedure
    .input(updateFolderPermissionsInput)
    .mutation(async ({ ctx, input }) => {
      return updateFolderPermissions(ctx, input);
    }),
});

export type FolderRouter = typeof folderRouter;

