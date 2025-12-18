import { z } from "zod";

export const retrieveOriginalUrlSchema = z.object({
  alias: z.string(),
  domain: z.string(),
  // have a from that specifies who called this function, whether the metadata generation func
  // or the actual domain retriever
  from: z.enum(["metadata", "redirection"]),
  geolocation: z
    .object({
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      country: z.string().optional(),
      city: z.string().optional(),
    })
    .optional(),
});

export const getLinkSchema = z.object({
  id: z.number(),
});

export const listLinksSchema = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(10),
  orderBy: z
    .enum(["createdAt", "totalClicks", "lastClicked"])
    .default("createdAt"),
  orderDirection: z.enum(["asc", "desc"]).default("desc"),
  tag: z.string().optional(),
  archivedFilter: z.enum(["active", "archived", "all"]).optional(),
  search: z.string().optional(),
});

export const createLinkSchema = z.object({
  url: z.string(),
  name: z.string().optional(),
  alias: z.string().optional(),
  disableLinkAfterClicks: z.number().optional(),
  disableLinkAfterDate: z.date().optional(),
  password: z.string().optional(),
  domain: z.string().optional(),
  note: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      image: z.string().optional(),
    })
    .optional(),
});

export const quickLinkShorteningSchema = z.object({
  url: z.string().url(),
  tags: z.array(z.string()).optional(),
});

export const updateLinkSchema = createLinkSchema.partial().extend({
  id: z.number(),
  name: z.string().optional(),
  disabled: z.boolean().optional(),
  publicStats: z.boolean().optional(),
  note: z.string().optional(),
});

export const verifyLinkPasswordSchema = z.object({
  id: z.number(),
  password: z.string(),
});

export const rangeEnum = z.enum([
  "24h",
  "7d",
  "30d",
  "90d",
  "this_month",
  "last_month",
  "this_year",
  "last_year",
  "all",
]);

export type RangeEnum = z.infer<typeof rangeEnum>;

export type CreateLinkInput = z.infer<typeof createLinkSchema>;
export type UpdateLinkInput = z.infer<typeof updateLinkSchema>;
export type GetLinkInput = z.infer<typeof getLinkSchema>;
export type RetrieveOriginalUrlInput = z.infer<
  typeof retrieveOriginalUrlSchema
>;

export type QuickLinkShorteningInput = z.infer<
  typeof quickLinkShorteningSchema
>;

export type ListLinksInput = z.infer<typeof listLinksSchema>;

export const listLinksOutputSchema = z.object({
  links: z.array(z.any()),
  totalLinks: z.number(),
  totalClicks: z.number(),
  currentPage: z.number(),
  totalPages: z.number(),
});

export type ListLinksOutput = z.infer<typeof listLinksOutputSchema>;

export const ToggleArchiveInput = z.object({ id: z.number() });
export type ToggleArchiveInput = z.infer<typeof ToggleArchiveInput>;

export const allAnalyticsSchema = z.object({
  range: rangeEnum.default("7d"),
  filterType: z.enum(["all", "folder", "domain", "link"]).default("all"),
  filterId: z.union([z.number(), z.string()]).optional(),
});

export type AllAnalyticsInput = z.infer<typeof allAnalyticsSchema>;
