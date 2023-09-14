import * as zod from "zod";

export const linkSchema = zod.object({
  url: zod.string().url(),
  alias: zod.string().min(3).max(10).optional(),
});

export type Link = zod.infer<typeof linkSchema>;
