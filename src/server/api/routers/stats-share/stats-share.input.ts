import { z } from "zod";

export const getStatsShareInput = z.object({
  id: z.number(),
});

export const setStatsShareInput = z.object({
  id: z.number(),
  enabled: z.boolean(),
});

export const resetStatsShareInput = z.object({
  id: z.number(),
});

export type GetStatsShareInput = z.infer<typeof getStatsShareInput>;
export type SetStatsShareInput = z.infer<typeof setStatsShareInput>;
export type ResetStatsShareInput = z.infer<typeof resetStatsShareInput>;
