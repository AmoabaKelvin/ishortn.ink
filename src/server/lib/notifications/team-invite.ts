import TeamInviteEmail from "@/emails/team-invite";
import { getAppBaseDomain } from "@/lib/constants/domains";
import { logger } from "@/lib/logger";

import { resend } from "./resend-client";

const log = logger.child({ notification: "team-invite" });

type SendTeamInviteEmailInput = {
  email: string;
  recipientName?: string | null;
  teamName: string;
  teamSlug: string;
  inviterName: string;
  role: "admin" | "member";
  token: string;
};

export async function sendTeamInviteEmail({
  email,
  recipientName,
  teamName,
  teamSlug,
  inviterName,
  role,
  token,
}: SendTeamInviteEmailInput) {
  if (!resend) return;

  const baseDomain = getAppBaseDomain();
  const inviteUrl = `https://${baseDomain}/teams/accept-invite?token=${encodeURIComponent(token)}`;

  try {
    await resend.emails.send({
      from: "Kelvin from iShortn <kelvin@ishortn.ink>",
      to: email,
      subject: `Join ${teamName} on iShortn`,
      react: TeamInviteEmail({
        recipientName,
        teamName,
        teamSlug,
        inviterName,
        role,
        inviteUrl,
      }),
    });
  } catch (error) {
    log.error({ err: error, email, teamSlug, role }, "failed to send team invite email");
  }
}
