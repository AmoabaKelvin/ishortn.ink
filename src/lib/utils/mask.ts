/**
 * Mask an email address for logs. "john@example.com" -> "j***@example.com".
 * Returns "***" for malformed input rather than throwing, since this is
 * used on log paths where we must never crash the caller.
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const maskedLocal = local.length > 1 ? `${local[0]}***` : "***";
  return `${maskedLocal}@${domain}`;
}
