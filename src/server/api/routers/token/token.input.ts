import { z } from "zod";

const createTokenSchema = z.object({
  name: z.string(),
});

const deleteTokenSchema = z.object({
  id: z.number(),
});

export type CreateTokenInput = z.infer<typeof createTokenSchema>;
export type DeleteTokenInput = z.infer<typeof deleteTokenSchema>;

export { createTokenSchema, deleteTokenSchema };
