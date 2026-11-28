import TeamInviteEmail from "@/emails/team-invite";
import TeamInviteAcceptedEmail from "@/emails/team-invite-accepted";
import TeamMemberRemovedEmail from "@/emails/team-member-removed";
import { getAppUrl } from "@/lib/constants/domains";

import { EMAIL_FROM_SYSTEM, sendEmail } from "./send-email";

type SendTeamInviteEmailInput = {
  email: string;
  recipientId?: string | null;
  recipientName?: string | null;
  teamName: string;
  teamSlug: string;
  inviterName: string;
  role: "admin" | "member";
  inviteUrl: string;
};

/** Resolves to false when the email could not be sent, so the caller can offer the link instead. */
export function sendTeamInviteEmail({
  email,
  recipientId,
  recipientName,
  teamName,
  teamSlug,
  inviterName,
  role,
  inviteUrl,
}: SendTeamInviteEmailInput): Promise<boolean> {
  return sendEmail({
    template: "team-invite",
    from: EMAIL_FROM_SYSTEM,
    recipientId: recipientId ?? null,
    to: email,
    essential: true,
    subject: `Join ${teamName} on iShortn`,
    react: TeamInviteEmail({ recipientName, teamName, inviterName, role, inviteUrl }),
    context: { teamSlug, role },
  });
}

type SendTeamInviteAcceptedEmailInput = {
  inviterId: string;
  inviterEmail: string;
  inviterName?: string | null;
  memberName: string;
  memberEmail?: string | null;
  teamName: string;
  teamSlug: string;
  role: "admin" | "member";
};

export function sendTeamInviteAcceptedEmail({
  inviterId,
  inviterEmail,
  inviterName,
  memberName,
  memberEmail,
  teamName,
  teamSlug,
  role,
}: SendTeamInviteAcceptedEmailInput): Promise<boolean> {
  return sendEmail({
    template: "team-invite-accepted",
    from: EMAIL_FROM_SYSTEM,
    recipientId: inviterId,
    to: inviterEmail,
    essential: true,
    subject: `${memberName} joined ${teamName} on iShortn`,
    react: TeamInviteAcceptedEmail({
      inviterName,
      memberName,
      memberEmail,
      teamName,
      role,
      membersUrl: getAppUrl("/dashboard/teams/members", teamSlug),
    }),
    context: { teamSlug },
  });
}

type SendTeamMemberRemovedEmailInput = {
  memberId: string;
  memberEmail: string;
  memberName?: string | null;
  teamName: string;
  teamSlug: string;
};

export function sendTeamMemberRemovedEmail({
  memberId,
  memberEmail,
  memberName,
  teamName,
  teamSlug,
}: SendTeamMemberRemovedEmailInput): Promise<boolean> {
  return sendEmail({
    template: "team-member-removed",
    from: EMAIL_FROM_SYSTEM,
    recipientId: memberId,
    to: memberEmail,
    essential: true,
    subject: `You were removed from ${teamName} on iShortn`,
    react: TeamMemberRemovedEmail({
      memberName,
      teamName,
      dashboardUrl: getAppUrl("/dashboard"),
    }),
    context: { teamSlug },
  });
}
