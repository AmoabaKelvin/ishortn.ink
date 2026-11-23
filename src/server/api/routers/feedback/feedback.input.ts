import { z } from "zod";

export const replyToFeedbackInput = z.object({
  id: z.number().int().positive(),
  message: z.string().trim().min(1, "Write a reply first").max(5000),
});

export type ReplyToFeedbackInput = z.infer<typeof replyToFeedbackInput>;
