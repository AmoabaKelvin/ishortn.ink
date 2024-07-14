import { z } from "zod";

export const retrieveOriginalUrlSchema = z.object({
  alias: z.string(),
  domain: z.string(),
});

export const getLinkSchema = z.object({
  id: z.number(),
  // alias: z.string(),
  // domain: z.string(),
});

export const createLinkSchema = z.object({
  url: z.string(),
  alias: z.string().optional(),
  disableLinkAfterClicks: z.number().optional(),
  disableLinkAfterDate: z.date().optional(),
  password: z.string().optional(),
  domain: z.string().optional(),
});

export const quickLinkShorteningSchema = z.object({
  url: z.string().url(),
});

export const updateLinkSchema = createLinkSchema.partial().extend({
  id: z.number(),
  disabled: z.boolean().optional(),
  publicStats: z.boolean().optional(),
});

export const verifyLinkPasswordSchema = z.object({
  id: z.number(),
  password: z.string(),
});

export type CreateLinkInput = z.infer<typeof createLinkSchema>;
export type UpdateLinkInput = z.infer<typeof updateLinkSchema>;
export type GetLinkInput = z.infer<typeof getLinkSchema>;
export type RetrieveOriginalUrlInput = z.infer<typeof retrieveOriginalUrlSchema>;

export type QuickLinkShorteningInput = z.infer<typeof quickLinkShorteningSchema>;
