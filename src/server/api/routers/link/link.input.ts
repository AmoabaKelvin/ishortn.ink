import { z } from "zod";

// OG image validator: accepts either a URL or a base64 data URI (PNG/JPEG/GIF) under 2MB
const MAX_OG_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

const isValidUrl = (value: string): boolean => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const isValidBase64Image = (value: string): boolean => {
  const base64Regex = /^data:image\/(png|jpe?g|gif);base64,[A-Za-z0-9+/]+=*$/;
  if (!base64Regex.test(value)) return false;

  const base64Payload = value.split(",")[1];
  if (!base64Payload) return false;

  const padding = (base64Payload.match(/=+$/) || [""])[0].length;
  const decodedSize = Math.ceil((base64Payload.length * 3) / 4) - padding;

  return decodedSize <= MAX_OG_IMAGE_SIZE_BYTES;
};

const ogImageSchema = z
  .string()
  .refine((value) => {
    if (!value) return true;

    if (value.startsWith("data:image/")) {
      return isValidBase64Image(value);
    }

    return isValidUrl(value);
  }, "Image must be a valid URL or a base64 PNG/JPEG/GIF under 2MB")
  .optional();

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
      image: ogImageSchema,
    })
    .optional(),
  utmParams: z
    .object({
      utm_source: z.string().max(255).optional(),
      utm_medium: z.string().max(255).optional(),
      utm_campaign: z.string().max(255).optional(),
      utm_term: z.string().max(255).optional(),
      utm_content: z.string().max(255).optional(),
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

// ============================================================================
// TRANSFER LINKS SCHEMAS
// ============================================================================

const transferLinksBaseSchema = z.object({
  linkIds: z.array(z.number().min(1)).min(1, "At least one link is required").max(100, "Maximum 100 links per transfer"),
});

const transferToPersonalSchema = transferLinksBaseSchema.extend({
  targetWorkspaceType: z.literal("personal"),
  targetTeamId: z.undefined().optional(),
});

const transferToTeamSchema = transferLinksBaseSchema.extend({
  targetWorkspaceType: z.literal("team"),
  targetTeamId: z.number().min(1, "Team ID is required for team transfers"),
});

export const transferLinksToWorkspaceSchema = z.discriminatedUnion("targetWorkspaceType", [
  transferToPersonalSchema,
  transferToTeamSchema,
]);

export type TransferLinksToWorkspaceInput = z.infer<typeof transferLinksToWorkspaceSchema>;

export const validateTransferSchema = transferLinksToWorkspaceSchema;
export type ValidateTransferInput = z.infer<typeof validateTransferSchema>;

export const bulkDeleteLinksSchema = z.object({
  linkIds: z.array(z.number().min(1)).min(1, "At least one link is required").max(100, "Maximum 100 links per deletion"),
});

export type BulkDeleteLinksInput = z.infer<typeof bulkDeleteLinksSchema>;

export const bulkArchiveLinksSchema = z.object({
  linkIds: z.array(z.number().min(1)).min(1, "At least one link is required").max(100, "Maximum 100 links per operation"),
  archive: z.boolean(),
});

export type BulkArchiveLinksInput = z.infer<typeof bulkArchiveLinksSchema>;

export const bulkToggleLinkStatusSchema = z.object({
  linkIds: z.array(z.number().min(1)).min(1, "At least one link is required").max(100, "Maximum 100 links per operation"),
  disable: z.boolean(),
});

export type BulkToggleLinkStatusInput = z.infer<typeof bulkToggleLinkStatusSchema>;
