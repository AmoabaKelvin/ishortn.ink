import { z } from "zod";

export const DOWNGRADE_REASONS = [
  "too_expensive",
  "not_using_features",
  "switching_to_competitor",
  "temporary_pause",
  "missing_features",
  "other",
] as const;

export const downgradeReasonLabels: Record<
  (typeof DOWNGRADE_REASONS)[number],
  string
> = {
  too_expensive: "Too expensive for my needs",
  not_using_features: "Not using the premium features",
  switching_to_competitor: "Switching to a different service",
  temporary_pause: "Taking a temporary break",
  missing_features: "Missing features I need",
  other: "Other reason",
};

export const downgradeWithFeedbackInput = z.object({
  targetPlan: z.enum(["pro", "free"]),
  reason: z.enum(DOWNGRADE_REASONS),
  additionalFeedback: z.string().max(1000).optional(),
});

export type DowngradeWithFeedbackInput = z.infer<
  typeof downgradeWithFeedbackInput
>;
