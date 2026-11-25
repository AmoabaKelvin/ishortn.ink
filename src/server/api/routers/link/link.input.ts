import { z } from "zod";

import { isValidTargetingValue } from "@/lib/constants/targeting";
import { destinationUrlSchema } from "@/lib/utils/destination-url";

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

export const linkOrderByEnum = z.enum(["createdAt", "totalClicks", "lastClicked"]);
export const linkOrderDirectionEnum = z.enum(["asc", "desc"]);
export const linkArchivedFilterEnum = z.enum(["active", "archived", "all"]);

export const listLinksSchema = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(10),
  orderBy: linkOrderByEnum.default("createdAt"),
  orderDirection: linkOrderDirectionEnum.default("desc"),
  tag: z.string().optional(),
  campaignId: z.number().optional(),
  archivedFilter: linkArchivedFilterEnum.optional(),
  search: z.string().optional(),
});

export const geoRuleInputSchema = z
  .object({
    type: z.enum(["country", "continent", "device", "os"]),
    condition: z.enum(["in", "not_in"]),
    values: z.array(z.string().max(20)).min(1, "At least one value is required"),
    action: z.enum(["redirect", "block"]),
    destination: z.string().url().optional().or(z.literal("")),
    blockMessage: z.string().max(500).optional(),
  })
  .refine((data) => data.values.every((value) => isValidTargetingValue(data.type, value)), {
    message: "Invalid value for this rule type",
    path: ["values"],
  })
  .refine(
    (data) => {
      if (data.action === "redirect") {
        return data.destination && data.destination.length > 0;
      }
      return true;
    },
    {
      message: "Destination URL is required for redirect action",
      path: ["destination"],
    },
  );

// Widths of the Link varchar columns. MySQL runs in strict mode, so a longer value
// fails the insert with ER_DATA_TOO_LONG instead of being truncated.
export const LINK_NAME_MAX_LENGTH = 255;
export const LINK_NOTE_MAX_LENGTH = 255;
export const LINK_ALIAS_MAX_LENGTH = 20;
export const LINK_DOMAIN_MAX_LENGTH = 255;

export const linkNameSchema = z
  .string()
  .max(LINK_NAME_MAX_LENGTH, `Link name can be at most ${LINK_NAME_MAX_LENGTH} characters`);
export const linkNoteSchema = z
  .string()
  .max(LINK_NOTE_MAX_LENGTH, `Note can be at most ${LINK_NOTE_MAX_LENGTH} characters`);
export const linkAliasSchema = z
  .string()
  .max(LINK_ALIAS_MAX_LENGTH, `Alias can be at most ${LINK_ALIAS_MAX_LENGTH} characters`);
export const linkDomainSchema = z
  .string()
  .max(LINK_DOMAIN_MAX_LENGTH, `Domain can be at most ${LINK_DOMAIN_MAX_LENGTH} characters`);

export const createLinkSchema = z.object({
  url: destinationUrlSchema,
  name: linkNameSchema.optional(),
  alias: linkAliasSchema.optional(),
  disableLinkAfterClicks: z.number().optional(),
  disableLinkAfterDate: z.date().optional(),
  activateAt: z.date().nullable().optional(),
  password: z.string().optional(),
  domain: linkDomainSchema.optional(),
  note: linkNoteSchema.optional(),
  // Tag.name is varchar(50).
  tags: z.array(z.string().max(50, "Tags can be at most 50 characters")).optional(),
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
  cloaking: z.boolean().optional(),
  verifiedClicksEnabled: z.boolean().optional(),
  geoRules: z.array(geoRuleInputSchema).optional(),
  campaignId: z.number().nullable().optional(),
});

export const quickLinkShorteningSchema = z.object({
  url: destinationUrlSchema,
  tags: z.array(z.string().max(50, "Tags can be at most 50 characters")).optional(),
});

export const updateLinkSchema = createLinkSchema.partial().extend({
  id: z.number(),
  name: linkNameSchema.optional(),
  disabled: z.boolean().optional(),
  publicStats: z.boolean().optional(),
  note: linkNoteSchema.optional(),
  cloaking: z.boolean().optional(),
  verifiedClicksEnabled: z.boolean().optional(),
});

export const verifyLinkPasswordSchema = z.object({
  id: z.number().int().positive(),
  // bcrypt only reads the first 72 bytes; the cap keeps oversized bodies cheap.
  password: z.string().min(1).max(256),
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

// Link and overview analytics also take a custom range of UTC days (`from`/`to`).
export const analyticsRangeEnum = z.enum([...rangeEnum.options, "custom"]);
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const analyticsRangeSchema = z.object({
  range: analyticsRangeEnum.default("7d"),
  from: isoDay.optional(),
  to: isoDay.optional(),
});

export const linkVisitsSchema = analyticsRangeSchema.extend({
  id: z.string(),
  // Omitted: the workspace's default domain.
  domain: z.string().optional(),
});

export type LinkVisitsInput = z.infer<typeof linkVisitsSchema>;

export type CreateLinkInput = z.infer<typeof createLinkSchema>;
export type UpdateLinkInput = z.infer<typeof updateLinkSchema>;
export type GetLinkInput = z.infer<typeof getLinkSchema>;
export type RetrieveOriginalUrlInput = z.infer<typeof retrieveOriginalUrlSchema>;
export type VerifyLinkPasswordInput = z.infer<typeof verifyLinkPasswordSchema>;

export type QuickLinkShorteningInput = z.infer<typeof quickLinkShorteningSchema>;

export type ListLinksInput = z.infer<typeof listLinksSchema>;

export const ToggleArchiveInput = z.object({ id: z.number() });
export type ToggleArchiveInput = z.infer<typeof ToggleArchiveInput>;

export const analyticsFilterTypeEnum = z.enum(["all", "folder", "domain", "link", "campaign"]);

export const allAnalyticsSchema = analyticsRangeSchema.extend({
  filterType: analyticsFilterTypeEnum.default("all"),
  filterId: z.union([z.number(), z.string()]).optional(),
});

export type AllAnalyticsInput = z.infer<typeof allAnalyticsSchema>;

// With `link`, the clicks of that one link (per-link analytics); without it,
// the overview's links narrowed by `filterType`/`filterId`.
export const exportClicksSchema = allAnalyticsSchema.extend({
  link: z.object({ alias: z.string().min(1), domain: z.string().min(1) }).optional(),
});

export type ExportClicksInput = z.infer<typeof exportClicksSchema>;

// ============================================================================
// TRANSFER LINKS SCHEMAS
// ============================================================================

const transferLinksBaseSchema = z.object({
  linkIds: z
    .array(z.number().min(1))
    .min(1, "At least one link is required")
    .max(100, "Maximum 100 links per transfer"),
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
  linkIds: z
    .array(z.number().min(1))
    .min(1, "At least one link is required")
    .max(100, "Maximum 100 links per deletion"),
});

export type BulkDeleteLinksInput = z.infer<typeof bulkDeleteLinksSchema>;

export const bulkArchiveLinksSchema = z.object({
  linkIds: z
    .array(z.number().min(1))
    .min(1, "At least one link is required")
    .max(100, "Maximum 100 links per operation"),
  archive: z.boolean(),
});

export type BulkArchiveLinksInput = z.infer<typeof bulkArchiveLinksSchema>;

export const bulkToggleLinkStatusSchema = z.object({
  linkIds: z
    .array(z.number().min(1))
    .min(1, "At least one link is required")
    .max(100, "Maximum 100 links per operation"),
  disable: z.boolean(),
});

export type BulkToggleLinkStatusInput = z.infer<typeof bulkToggleLinkStatusSchema>;

export const bulkUploadSchema = z.object({
  csv: z.string(),
  keepBitlyCodes: z.boolean().default(true),
});
