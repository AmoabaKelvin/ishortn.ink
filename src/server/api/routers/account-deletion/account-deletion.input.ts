import { z } from "zod";

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

// Mirrors the onboarding survey's "what were you using before" list.
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
  confirmEmail: z.string().trim().min(1),
});

export type RequestAccountDeletionInput = z.infer<typeof requestAccountDeletionSchema>;
