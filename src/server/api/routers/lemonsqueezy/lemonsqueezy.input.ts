import { z } from "zod";

import { ATTRIBUTION_VALUE_MAX_LENGTH } from "@/lib/billing/attribution";
import { PAUSE_MONTH_OPTIONS } from "@/lib/billing/plans";

const attributionValue = z.string().max(ATTRIBUTION_VALUE_MAX_LENGTH).optional();

export const createCheckoutOrUpdateInput = z.object({
  plan: z.enum(["pro", "ultra"]),
  interval: z.enum(["monthly", "annual"]).default("monthly"),
  /** Where the checkout was started from, logged to `CheckoutStart`. */
  source: attributionValue,
  /** Campaign tags carried from the pricing page, passed to the checkout's custom data. */
  utm: z
    .object({
      utm_source: attributionValue,
      utm_medium: attributionValue,
      utm_campaign: attributionValue,
      utm_term: attributionValue,
      utm_content: attributionValue,
    })
    .optional(),
});

export type CreateCheckoutOrUpdateInput = z.infer<typeof createCheckoutOrUpdateInput>;

export const previewPlanChangeInput = createCheckoutOrUpdateInput.pick({
  plan: true,
  interval: true,
});

export const DOWNGRADE_REASONS = [
  "too_expensive",
  "not_using_features",
  "switching_to_competitor",
  "temporary_pause",
  "missing_features",
  "other",
] as const;

export const downgradeReasonLabels = {
  too_expensive: "Too expensive for my needs",
  not_using_features: "Not using the premium features",
  switching_to_competitor: "Switching to a different service",
  temporary_pause: "Taking a temporary break",
  missing_features: "Missing features I need",
  other: "Other reason",
} satisfies Record<(typeof DOWNGRADE_REASONS)[number], string>;

export const downgradeWithFeedbackInput = z.object({
  targetPlan: z.enum(["pro", "free"]),
  reason: z.enum(DOWNGRADE_REASONS),
  additionalFeedback: z.string().max(1000).optional(),
});

export type DowngradeWithFeedbackInput = z.infer<typeof downgradeWithFeedbackInput>;

export const pauseSubscriptionInput = z.object({
  months: z
    .number()
    .int()
    .refine((months) => PAUSE_MONTH_OPTIONS.some((option) => option === months), {
      message: "Choose a pause of 1 to 3 months",
    }),
  reason: z.enum(DOWNGRADE_REASONS),
  feedback: z.string().max(1000).optional(),
});

export type PauseSubscriptionInput = z.infer<typeof pauseSubscriptionInput>;
