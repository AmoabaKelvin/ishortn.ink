import { z } from "zod";

export const createFolderInput = z.object({
  name: z.string().min(1, "Folder name is required").max(255, "Folder name is too long"),
  description: z.string().optional(),
});

export const updateFolderInput = z.object({
  id: z.number(),
  name: z.string().min(1, "Folder name is required").max(255, "Folder name is too long"),
  description: z.string().optional(),
});

export const deleteFolderInput = z.object({
  id: z.number(),
});

export const getFolderInput = z.object({
  id: z.number(),
});

export const moveLinkToFolderInput = z.object({
  linkId: z.number(),
  folderId: z.number().nullable(),
});

export const moveBulkLinksToFolderInput = z.object({
  linkIds: z.array(z.number()),
  folderId: z.number().nullable(),
});

export type CreateFolderInput = z.infer<typeof createFolderInput>;
export type UpdateFolderInput = z.infer<typeof updateFolderInput>;
export type DeleteFolderInput = z.infer<typeof deleteFolderInput>;
export type GetFolderInput = z.infer<typeof getFolderInput>;
export type MoveLinkToFolderInput = z.infer<typeof moveLinkToFolderInput>;
export type MoveBulkLinksToFolderInput = z.infer<typeof moveBulkLinksToFolderInput>;

