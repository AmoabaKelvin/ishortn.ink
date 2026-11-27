// Team and QA accounts. Their activity stays out of PostHog so limit, upgrade and checkout
// metrics count real users only.
const INTERNAL_EMAIL_DOMAINS: ReadonlySet<string> = new Set(["euploading.com", "mail.ishortn.ink"]);

/** Whether `email` belongs to an internal account; unknown emails count as external. */
export function isInternalEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const at = email.lastIndexOf("@");
  return (
    at !== -1 &&
    INTERNAL_EMAIL_DOMAINS.has(
      email
        .slice(at + 1)
        .trim()
        .toLowerCase(),
    )
  );
}
