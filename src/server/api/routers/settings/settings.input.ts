import { z } from "zod";

export const updateSiteSettingsSchema = z.object({
  defaultDomain: z.string(),
});

export type UpdateSiteSettingsInput = z.infer<typeof updateSiteSettingsSchema>;
