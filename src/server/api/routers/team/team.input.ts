import { z } from "zod";

import { RESERVED_TEAM_SLUGS } from "@/server/db/schema";

// Slug validation regex: lowercase letters, numbers, and hyphens only
const slugRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

export const createTeamSchema = z.object({
  name: z
    .string()
    .min(1, "Team name is required")
    .max(255, "Team name is too long"),
  slug: z
    .string()
    .min(3, "Team slug must be at least 3 characters")
    .max(50, "Team slug is too long")
    .regex(
      slugRegex,
      "Slug can only contain lowercase letters, numbers, and hyphens"
    )
    .refine(
      (slug) => !RESERVED_TEAM_SLUGS.includes(slug),
      "This slug is reserved and cannot be used"
    ),
});

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  defaultDomain: z.string().max(255).optional(),
});

export const updateTeamSlugSchema = z.object({
  slug: z
    .string()
    .min(3, "Team slug must be at least 3 characters")
    .max(50, "Team slug is too long")
    .regex(
      slugRegex,
      "Slug can only contain lowercase letters, numbers, and hyphens"
    )
    .refine(
      (slug) => !RESERVED_TEAM_SLUGS.includes(slug),
      "This slug is reserved and cannot be used"
    ),
});

export const inviteMemberSchema = z.object({
  email: z.string().email().optional(),
  role: z.enum(["admin", "member"]).default("member"),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1, "Invite token is required"),
});

export const updateMemberRoleSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  role: z.enum(["admin", "member"]),
});

export const removeMemberSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

export const revokeInviteSchema = z.object({
  inviteId: z.number(),
});

export const checkSlugSchema = z.object({
  slug: z.string().min(1),
});

export const transferOwnershipSchema = z.object({
  newOwnerId: z.string().min(1, "New owner ID is required"),
});

// Type exports
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type UpdateTeamSlugInput = z.infer<typeof updateTeamSlugSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
export type RevokeInviteInput = z.infer<typeof revokeInviteSchema>;
export type CheckSlugInput = z.infer<typeof checkSlugSchema>;
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;
