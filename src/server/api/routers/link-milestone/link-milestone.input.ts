import { z } from "zod";

export const upsertMilestonesSchema = z.object({
  linkId: z.number().int().positive(),
  thresholds: z
    .array(z.number().int().positive())
    .transform((arr) => [...new Set(arr)]), // deduplicate
});

export const getLinkMilestonesSchema = z.object({
  linkId: z.number().int().positive(),
});

export const resetMilestoneNotificationsSchema = z.object({
  linkId: z.number().int().positive(),
});

export type UpsertMilestonesInput = z.infer<typeof upsertMilestonesSchema>;
export type GetLinkMilestonesInput = z.infer<typeof getLinkMilestonesSchema>;
export type ResetMilestoneNotificationsInput = z.infer<typeof resetMilestoneNotificationsSchema>;
