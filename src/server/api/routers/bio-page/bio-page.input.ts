import { z } from "zod";

export const bioBlockTypeSchema = z.enum([
  "link",
  "heading",
  "text",
  "social",
  "divider",
  "email",
]);

export const bioThemeSchema = z.object({
  preset: z.string().max(50).optional(),
  accentColor: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Invalid color")
    .optional(),
  buttonStyle: z.enum(["rounded", "pill", "sharp", "outline"]).optional(),
  background: z
    .object({
      type: z.enum(["solid", "gradient"]),
      color: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .optional(),
  font: z.string().max(50).optional(),
});

export const bioSocialLinkSchema = z.object({
  platform: z.string().min(1).max(50),
  // Accept a handle, email, bare domain, or full URL; the service canonicalizes
  // it into a real href via normalizeSocialUrl, so don't force .url() here.
  url: z.string().trim().min(1).max(2048),
});

export const bioSlugSchema = z
  .string()
  .min(3, "Handle must be at least 3 characters")
  .max(100)
  .regex(
    /^[a-z0-9_-]+$/,
    "Use lowercase letters, numbers, dashes, and underscores only",
  );

export const createBioPageSchema = z.object({
  slug: bioSlugSchema,
  title: z.string().max(255).optional(),
  description: z.string().max(1000).optional(),
});

export const updateBioPageSchema = z.object({
  id: z.number(),
  slug: bioSlugSchema.optional(),
  title: z.string().max(255).nullish(),
  description: z.string().max(1000).nullish(),
  avatarUrl: z.string().nullish(), // base64 data URL or existing https URL; null clears it
  theme: bioThemeSchema.nullish(),
  socialImageUrl: z.string().nullish(),
  seoTitle: z.string().max(255).nullish(),
  seoDescription: z.string().max(500).nullish(),
  customDomain: z.string().max(255).nullish(),
  removeBranding: z.boolean().optional(),
});

export const bioPageIdSchema = z.object({ id: z.number() });

export const togglePublishedSchema = z.object({
  id: z.number(),
  isPublished: z.boolean(),
});

export const getPublicBioPageSchema = z.object({ slug: z.string() });
export const getPublicBioPageByDomainSchema = z.object({ domain: z.string() });

export const getBioPageAnalyticsSchema = z.object({
  id: z.number(),
  range: z.enum(["7d", "30d", "90d", "all"]).default("7d"),
});

// Block payload shared by add/update. The service interprets fields by block type.
const blockFieldsSchema = {
  title: z.string().max(255).nullish(),
  content: z.string().max(5000).nullish(), // text body
  url: z.string().max(2048).nullish(), // link destination / email address
  socials: z.array(bioSocialLinkSchema).max(20).optional(), // social blocks
  scheduledAt: z.date().nullish(), // Ultra
  scheduledUntil: z.date().nullish(), // Ultra
};

export const addBioBlockSchema = z.object({
  bioPageId: z.number(),
  type: bioBlockTypeSchema,
  ...blockFieldsSchema,
});

export const updateBioBlockSchema = z.object({
  id: z.number(),
  isVisible: z.boolean().optional(),
  ...blockFieldsSchema,
});

export const blockIdSchema = z.object({ id: z.number() });

export const reorderBlocksSchema = z.object({
  bioPageId: z.number(),
  blockIds: z.array(z.number()),
});

export type CreateBioPageInput = z.infer<typeof createBioPageSchema>;
export type UpdateBioPageInput = z.infer<typeof updateBioPageSchema>;
export type AddBioBlockInput = z.infer<typeof addBioBlockSchema>;
export type UpdateBioBlockInput = z.infer<typeof updateBioBlockSchema>;
export type ReorderBlocksInput = z.infer<typeof reorderBlocksSchema>;
export type BioThemeInput = z.infer<typeof bioThemeSchema>;
