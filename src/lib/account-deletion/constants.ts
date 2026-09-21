/** Days a soft-deleted account can still be restored before the purge job runs. */
export const DELETION_GRACE_PERIOD_DAYS = 30;

/**
 * Sentinel written to link.blockedReason when an account deletion cascades to
 * the owner's links, so restore can tell them apart from links blocked for
 * abuse. Same trick the ban cascade uses (admin.service.ts BAN_CASCADE_REASON).
 * Never shown to visitors — see the blocked page.
 */
export const DELETION_CASCADE_REASON = "Owner account deleted" as const;

export function purgeDateFor(deletedAt: Date): Date {
  const purgeAt = new Date(deletedAt);
  purgeAt.setDate(purgeAt.getDate() + DELETION_GRACE_PERIOD_DAYS);
  return purgeAt;
}
