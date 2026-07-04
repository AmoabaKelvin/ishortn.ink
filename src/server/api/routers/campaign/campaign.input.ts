import { z } from "zod";

import { rangeEnum } from "../link/link.input";

const utmFieldSchema = z.string().max(255).nullable().optional();

export const campaignIdSchema = z.object({
  id: z.number(),
});

export const campaignSlugSchema = z.object({
  slug: z.string().min(1).max(100),
});

export const listCampaignsSchema = z.object({
  status: z.enum(["active", "archived", "all"]).default("active"),
});

export const createCampaignSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
    slug: z.string().trim().max(100).optional(),
    description: z.string().max(2000).optional(),
    startDate: z.date().nullable().optional(),
    endDate: z.date().nullable().optional(),
  })
  .refine((data) => !data.startDate || !data.endDate || data.endDate >= data.startDate, {
    message: "End date must be after the start date",
    path: ["endDate"],
  });

export const updateCampaignSchema = z
  .object({
    id: z.number(),
    name: z.string().trim().min(1).max(100).optional(),
    slug: z.string().trim().min(1).max(100).optional(),
    description: z.string().max(2000).nullable().optional(),
    status: z.enum(["active", "archived"]).optional(),
    startDate: z.date().nullable().optional(),
    endDate: z.date().nullable().optional(),
    utmSource: utmFieldSchema,
    utmMedium: utmFieldSchema,
    utmTerm: utmFieldSchema,
    utmContent: utmFieldSchema,
  })
  .refine((data) => !data.startDate || !data.endDate || data.endDate >= data.startDate, {
    message: "End date must be after the start date",
    path: ["endDate"],
  });

export const addLinksSchema = z.object({
  id: z.number(),
  linkIds: z.array(z.number().min(1)).min(1, "Select at least one link").max(100),
  applyUtmDefaults: z.boolean().default(false),
});

export const removeLinkSchema = z.object({
  id: z.number(),
  linkId: z.number(),
});

export const campaignAnalyticsSchema = z.object({
  id: z.number(),
  range: rangeEnum.default("30d"),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type ListCampaignsInput = z.infer<typeof listCampaignsSchema>;
export type AddLinksInput = z.infer<typeof addLinksSchema>;
export type RemoveLinkInput = z.infer<typeof removeLinkSchema>;
export type CampaignAnalyticsInput = z.infer<typeof campaignAnalyticsSchema>;
