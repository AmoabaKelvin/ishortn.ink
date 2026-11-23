import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { feedback } from "@/server/db/schema";
import { sendFeedbackReplyEmail } from "@/server/lib/notifications/feedback-reply";

import type { ProtectedTRPCContext } from "../../trpc";
import type { ReplyToFeedbackInput } from "./feedback.input";

/**
 * Emails the reply to the user who sent the feedback, then stores it and resolves the item.
 * The row only changes once the email was accepted, so a failed send can simply be retried.
 */
export const replyToFeedback = async (
  ctx: ProtectedTRPCContext,
  input: ReplyToFeedbackInput,
  send = sendFeedbackReplyEmail,
) => {
  const item = await ctx.db.query.feedback.findFirst({
    where: eq(feedback.id, input.id),
    columns: { id: true, userId: true, message: true, repliedAt: true },
    with: { user: { columns: { email: true, name: true } } },
  });

  if (!item) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Feedback not found" });
  }
  if (item.repliedAt) {
    throw new TRPCError({ code: "CONFLICT", message: "This feedback already has a reply" });
  }
  if (!item.user?.email) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This user has no email address on file",
    });
  }

  const sent = await send({
    feedbackId: item.id,
    userId: item.userId,
    toEmail: item.user.email,
    toName: item.user.name,
    reply: input.message,
    originalMessage: item.message,
  });
  if (!sent) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "The reply email couldn't be sent. Nothing was saved, so try again.",
    });
  }

  const repliedAt = new Date();
  await ctx.db
    .update(feedback)
    .set({ status: "resolved", replyMessage: input.message, repliedAt })
    .where(eq(feedback.id, item.id));

  return { repliedAt };
};
