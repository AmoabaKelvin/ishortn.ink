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

// --- Analytics inputs ---

export const dateRangeSchema = z
  .object({
    from: z.date(),
    to: z.date(),
  })
  .refine((d) => d.from <= d.to, {
    message: "from must be before or equal to to",
    path: ["from"],
  });

export const getAnalyticsSchema = dateRangeSchema;
export type GetAnalyticsInput = z.infer<typeof getAnalyticsSchema>;

export const getActivityChartSchema = dateRangeSchema.extend({
  granularity: z.enum(["day", "month"]).default("day"),
});
export type GetActivityChartInput = z.infer<typeof getActivityChartSchema>;

export const getTopUsersSchema = dateRangeSchema.extend({
  sortBy: z.enum(["links", "clicks"]).default("links"),
  limit: z.number().int().positive().max(100).default(20),
});
export type GetTopUsersInput = z.infer<typeof getTopUsersSchema>;

export const getTopLinksSchema = dateRangeSchema.extend({
  limit: z.number().int().positive().max(100).default(20),
});
export type GetTopLinksInput = z.infer<typeof getTopLinksSchema>;

export const getPeakPeriodsSchema = dateRangeSchema;
export type GetPeakPeriodsInput = z.infer<typeof getPeakPeriodsSchema>;

export const getMonthlyBreakdownSchema = dateRangeSchema;
export type GetMonthlyBreakdownInput = z.infer<typeof getMonthlyBreakdownSchema>;
