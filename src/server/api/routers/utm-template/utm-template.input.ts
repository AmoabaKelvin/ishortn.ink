import { z } from "zod";

export const createUtmTemplateInput = z.object({
  name: z.string().min(1, "Template name is required").max(100),
  utmSource: z.string().max(255).optional(),
  utmMedium: z.string().max(255).optional(),
  utmCampaign: z.string().max(255).optional(),
  utmTerm: z.string().max(255).optional(),
  utmContent: z.string().max(255).optional(),
});

export const updateUtmTemplateInput = z.object({
  id: z.number(),
  name: z.string().min(1).max(100).optional(),
  utmSource: z.string().max(255).optional(),
  utmMedium: z.string().max(255).optional(),
  utmCampaign: z.string().max(255).optional(),
  utmTerm: z.string().max(255).optional(),
  utmContent: z.string().max(255).optional(),
});

export const getUtmTemplateInput = z.object({
  id: z.number(),
});

export const deleteUtmTemplateInput = z.object({
  id: z.number(),
});

export type CreateUtmTemplateInput = z.infer<typeof createUtmTemplateInput>;
export type UpdateUtmTemplateInput = z.infer<typeof updateUtmTemplateInput>;
