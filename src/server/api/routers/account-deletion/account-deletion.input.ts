import { z } from "zod";

// Exit-survey reasons. Kept short and mutually exclusive: churn surveys get
// answered when there is one obvious pick, and the free-text field carries the
// nuance.
export const accountDeletionReasonValues = [
  "no_longer_needed",
  "too_expensive",
  "missing_feature",
  "hit_limits",
  "found_alternative",
  "too_complex",
  "reliability",
  "privacy",
  "duplicate_account",
  "other",
] as const;

// Same list the onboarding survey uses for "what were you using before", so
// switch-in and switch-out are comparable.
export const accountDeletionDestinationValues = [
  "bitly",
  "dub",
  "tinyurl",
  "rebrandly",
  "shortio",
  "self_hosted",
  "other",
] as const;

export const requestAccountDeletionSchema = z.object({
  reason: z.enum(accountDeletionReasonValues),
  destination: z.enum(accountDeletionDestinationValues).optional().nullable(),
  improvement: z.string().trim().max(2000).optional().nullable(),
  /** Typed confirmation — must match the account email. */
  confirmEmail: z.string().trim().min(1),
});

export type RequestAccountDeletionInput = z.infer<typeof requestAccountDeletionSchema>;
