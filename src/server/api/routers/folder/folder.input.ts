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

// Folder permissions input schemas
export const getFolderPermissionsInput = z.object({
  folderId: z.number(),
});

export const updateFolderPermissionsInput = z.object({
  folderId: z.number(),
  // When isRestricted=true: only admins/owners + userIds can access
  // When isRestricted=false: all team members can access (userIds ignored)
  isRestricted: z.boolean(),
  userIds: z.array(z.string()),
});

export type CreateFolderInput = z.infer<typeof createFolderInput>;
export type UpdateFolderInput = z.infer<typeof updateFolderInput>;
export type DeleteFolderInput = z.infer<typeof deleteFolderInput>;
export type GetFolderInput = z.infer<typeof getFolderInput>;
export type MoveLinkToFolderInput = z.infer<typeof moveLinkToFolderInput>;
export type MoveBulkLinksToFolderInput = z.infer<typeof moveBulkLinksToFolderInput>;
export type GetFolderPermissionsInput = z.infer<typeof getFolderPermissionsInput>;
export type UpdateFolderPermissionsInput = z.infer<typeof updateFolderPermissionsInput>;

