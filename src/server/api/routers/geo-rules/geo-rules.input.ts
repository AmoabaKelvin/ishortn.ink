import { z } from "zod";

// Base geo rule schema (without id and linkId)
export const geoRuleBaseSchema = z.object({
  type: z.enum(["country", "continent"]),
  condition: z.enum(["in", "not_in"]).default("in"),
  values: z
    .array(z.string().length(2).toUpperCase())
    .min(1, "At least one value is required"),
  action: z.enum(["redirect", "block"]),
  destination: z.string().url().max(2048).optional().nullable(),
  blockMessage: z.string().max(500).optional().nullable(),
  priority: z.number().int().min(0).default(0),
});

// Validate that destination is required for redirect actions
export const geoRuleInputSchema = geoRuleBaseSchema.refine(
  (data) => data.action !== "redirect" || (data.destination && data.destination.trim() !== ""),
  {
    message: "Destination URL is required for redirect actions",
    path: ["destination"],
  }
);

// Schema for creating a geo rule
export const createGeoRuleSchema = z.object({
  linkId: z.number().int().positive(),
  rule: geoRuleInputSchema,
});

// Schema for updating a geo rule
export const updateGeoRuleSchema = z.object({
  ruleId: z.number().int().positive(),
  rule: geoRuleInputSchema,
});

// Schema for deleting a geo rule
export const deleteGeoRuleSchema = z.object({
  ruleId: z.number().int().positive(),
});

// Schema for getting geo rules by link
export const getGeoRulesByLinkSchema = z.object({
  linkId: z.number().int().positive(),
});

// Schema for reordering geo rules
export const reorderGeoRulesSchema = z.object({
  linkId: z.number().int().positive(),
  ruleIds: z.array(z.number().int().positive()),
});

// Type exports
export type GeoRuleInput = z.infer<typeof geoRuleInputSchema>;
export type CreateGeoRuleInput = z.infer<typeof createGeoRuleSchema>;
export type UpdateGeoRuleInput = z.infer<typeof updateGeoRuleSchema>;
export type DeleteGeoRuleInput = z.infer<typeof deleteGeoRuleSchema>;
export type GetGeoRulesByLinkInput = z.infer<typeof getGeoRulesByLinkSchema>;
export type ReorderGeoRulesInput = z.infer<typeof reorderGeoRulesSchema>;
