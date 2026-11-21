import { z } from "zod";

export const TOKEN_NAME_MAX_LENGTH = 64;

const createTokenSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(TOKEN_NAME_MAX_LENGTH, `Name must be ${TOKEN_NAME_MAX_LENGTH} characters or less`),
});

const deleteTokenSchema = z.object({
  id: z.number(),
});

export type CreateTokenInput = z.infer<typeof createTokenSchema>;
export type DeleteTokenInput = z.infer<typeof deleteTokenSchema>;

export { createTokenSchema, deleteTokenSchema };
