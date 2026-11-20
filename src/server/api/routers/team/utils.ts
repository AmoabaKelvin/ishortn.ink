import type { TeamRole } from "@/server/db/schema";

// Per team, rolling 24 hours. Revoked invites still count, so revoking and
// re-sending can't be used to get around it.
export const DAILY_INVITE_EMAIL_LIMIT = 50;

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function inviteEmailMatches(inviteEmail: string, userEmail: string | null | undefined) {
  return !!userEmail && normalizeInviteEmail(inviteEmail) === normalizeInviteEmail(userEmail);
}

/**
 * Why `actorRole` can't give `targetRole` the role `newRole`, or null when allowed.
 * Admins manage members only: promoting to admin, or changing an admin's role in
 * either direction, is the owner's call (otherwise an admin could demote another
 * admin and then remove them).
 */
export function memberRoleChangeError(
  actorRole: TeamRole,
  targetRole: TeamRole,
  newRole: "admin" | "member",
): string | null {
  if (targetRole === "owner") {
    return "Cannot change the owner's role. Use transfer ownership instead.";
  }
  if (actorRole === "owner") return null;
  if (targetRole === "admin") return "Only the team owner can change an admin's role";
  if (newRole === "admin") return "Only the team owner can promote members to admin";
  return null;
}

type InviteState = {
  email: string | null;
  acceptedAt: Date | null;
  declinedAt: Date | null;
  expiresAt: Date;
};

export type InviteStatus = "pending" | "accepted" | "declined" | "expired";

export function inviteStatus(invite: InviteState, now = new Date()): InviteStatus {
  if (invite.acceptedAt) return "accepted";
  if (invite.declinedAt) return "declined";
  if (invite.expiresAt < now) return "expired";
  return "pending";
}

export type InviteView = "pending" | "member" | "used" | "expired" | "declined";

/**
 * What the accept-invite page shows. "Already a member" only when the viewer
 * actually is one; a link invite is single-use, so once it's been used or has
 * expired anyone else opening it gets the same "used or expired" message.
 */
export function inviteView(invite: InviteState, isMember: boolean, now = new Date()): InviteView {
  if (isMember) return "member";
  const status = inviteStatus(invite, now);
  if (status === "pending") return "pending";
  if (status === "accepted" || !invite.email) return "used";
  return status;
}
