import { z } from "zod";

// Resend webhook payloads: https://resend.com/docs/webhooks/emails/bounced
export const resendEmailEventSchema = z.object({
  type: z.string(),
  created_at: z.string().datetime({ offset: true }).optional(),
  data: z
    .object({
      to: z.union([z.string().transform((to) => [to]), z.array(z.string())]).default([]),
      bounce: z
        .object({
          type: z.string().optional(),
          subType: z.string().optional(),
          message: z.string().optional(),
        })
        .optional(),
    })
    .passthrough(),
});

export type ResendEmailEvent = z.infer<typeof resendEmailEventSchema>;

export type SuppressionType = "bounced" | "complained";

export type SuppressionAction =
  | { kind: "suppress"; type: SuppressionType; emails: string[]; at: Date; detail: string | null }
  | { kind: "clear"; emails: string[]; at: Date }
  | { kind: "ignore" };

/** `Ama <AMA@example.com>` and `ama@example.com` both become `ama@example.com`. */
export function normalizeEmail(value: string): string {
  const bracketed = /<([^>]+)>/.exec(value);
  return (bracketed?.[1] ?? value).trim().toLowerCase();
}

/**
 * Maps a verified Resend webhook event to what it means for the suppression list: hard bounces
 * and complaints suppress the recipients, a delivery clears an earlier bounce, the rest is ignored.
 */
export function suppressionActionFor(
  { type, created_at, data }: ResendEmailEvent,
  now: Date,
): SuppressionAction {
  const emails = [...new Set(data.to.map(normalizeEmail).filter((email) => email.includes("@")))];
  if (!emails.length) return { kind: "ignore" };

  const at = created_at ? new Date(created_at) : now;

  switch (type) {
    case "email.bounced": {
      // Temporary bounces (full mailbox, greylisting) resolve themselves; only Permanent suppresses.
      // Resend documents email.bounced as permanent, so a payload without a type counts as hard.
      const bounceType = data.bounce?.type;
      if (bounceType && bounceType !== "Permanent") return { kind: "ignore" };
      const detail = [data.bounce?.subType, data.bounce?.message].filter(Boolean).join(": ");
      return {
        kind: "suppress",
        type: "bounced",
        emails,
        at,
        detail: detail.slice(0, 255) || null,
      };
    }
    case "email.complained":
      return { kind: "suppress", type: "complained", emails, at, detail: null };
    case "email.delivered":
      return { kind: "clear", emails, at };
    default:
      return { kind: "ignore" };
  }
}
