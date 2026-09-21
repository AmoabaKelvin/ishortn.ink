export const DELETION_GRACE_PERIOD_DAYS = 30;

// link.blockedReason sentinel, same idea as BAN_CASCADE_REASON in admin.service.ts.
export const DELETION_CASCADE_REASON = "Owner account deleted" as const;

export function purgeDateFor(deletedAt: Date): Date {
  const purgeAt = new Date(deletedAt);
  purgeAt.setDate(purgeAt.getDate() + DELETION_GRACE_PERIOD_DAYS);
  return purgeAt;
}
