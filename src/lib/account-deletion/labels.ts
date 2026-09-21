import {
  accountDeletionDestinationValues,
  accountDeletionReasonValues,
} from "@/server/api/routers/account-deletion/account-deletion.input";

/** Ordered for the exit survey dropdown; also the source for Discord labels. */
export const ACCOUNT_DELETION_REASON_OPTIONS = [
  { value: "no_longer_needed", label: "I don't need a link shortener anymore" },
  { value: "found_alternative", label: "I'm moving to another tool" },
  { value: "missing_feature", label: "A feature I needed was missing" },
  { value: "hit_limits", label: "The plan limits were too tight" },
  { value: "too_expensive", label: "Too expensive for what I use" },
  { value: "too_complex", label: "Harder to use than I expected" },
  { value: "reliability", label: "Bugs, downtime, or links not working" },
  { value: "privacy", label: "Privacy or data concerns" },
  { value: "duplicate_account", label: "Cleaning up a duplicate or test account" },
  { value: "other", label: "Something else" },
] as const satisfies ReadonlyArray<{
  value: (typeof accountDeletionReasonValues)[number];
  label: string;
}>;

export const ACCOUNT_DELETION_DESTINATION_OPTIONS = [
  { value: "bitly", label: "Bitly" },
  { value: "dub", label: "Dub" },
  { value: "tinyurl", label: "TinyURL" },
  { value: "rebrandly", label: "Rebrandly" },
  { value: "shortio", label: "Short.io" },
  { value: "self_hosted", label: "Something self-hosted" },
  { value: "other", label: "Another tool" },
] as const satisfies ReadonlyArray<{
  value: (typeof accountDeletionDestinationValues)[number];
  label: string;
}>;

const LABELS = new Map<string, string>(
  [...ACCOUNT_DELETION_REASON_OPTIONS, ...ACCOUNT_DELETION_DESTINATION_OPTIONS].map((o) => [
    o.value,
    o.label,
  ]),
);

export function formatAccountDeletionLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return LABELS.get(value) ?? value;
}
