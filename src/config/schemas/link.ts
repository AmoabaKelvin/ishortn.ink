import * as zod from "zod";

export const linkSchema = zod.object({
  url: zod.string().url(),
  alias: zod.string().max(10).optional(),
});

export type Link = zod.infer<typeof linkSchema>;
