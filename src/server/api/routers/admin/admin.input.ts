import { z } from "zod";

export const searchLinksSchema = z.object({
  query: z.string().min(1),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

export type SearchLinksInput = z.infer<typeof searchLinksSchema>;

export const blockLinkSchema = z.object({
  linkId: z.number().int().positive(),
  reason: z.string().min(1).max(255),
});

export type BlockLinkInput = z.infer<typeof blockLinkSchema>;

export const unblockLinkSchema = z.object({
  linkId: z.number().int().positive(),
});

export type UnblockLinkInput = z.infer<typeof unblockLinkSchema>;

export const searchUsersSchema = z.object({
  query: z.string().min(1),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

export type SearchUsersInput = z.infer<typeof searchUsersSchema>;

export const banUserSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().min(1).max(255),
});

export type BanUserInput = z.infer<typeof banUserSchema>;

export const unbanUserSchema = z.object({
  userId: z.string().min(1),
});

export type UnbanUserInput = z.infer<typeof unbanUserSchema>;

export const addBlockedDomainSchema = z.object({
  domain: z.string().min(1).max(255),
  reason: z.string().max(255).optional(),
});

export type AddBlockedDomainInput = z.infer<typeof addBlockedDomainSchema>;

export const removeBlockedDomainSchema = z.object({
  id: z.number().int().positive(),
});

export type RemoveBlockedDomainInput = z.infer<typeof removeBlockedDomainSchema>;

export const getFlaggedLinksSchema = z.object({
  status: z.enum(["pending", "blocked", "dismissed"]).optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

export type GetFlaggedLinksInput = z.infer<typeof getFlaggedLinksSchema>;

export const resolveFlaggedLinkSchema = z.object({
  id: z.number().int().positive(),
  action: z.enum(["blocked", "dismissed"]),
});

export type ResolveFlaggedLinkInput = z.infer<typeof resolveFlaggedLinkSchema>;
