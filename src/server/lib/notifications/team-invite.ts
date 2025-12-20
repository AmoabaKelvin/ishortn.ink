import { Resend } from "resend";

import { env } from "@/env.mjs";
import TeamInviteEmail from "@/emails/team-invite";

type SendTeamInviteEmailInput = {
  email: string;
  recipientName?: string | null;
  teamName: string;
  teamSlug: string;
  inviterName: string;
  role: "admin" | "member";
  token: string;
};

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

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

  const baseDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || "ishortn.ink";
  const inviteUrl = `https://${baseDomain}/teams/accept-invite?token=${encodeURIComponent(token)}`;

  try {
    await resend.emails.send({
      from: "Kelvin <kelvin@ishortn.ink>",
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
    console.error("Failed to send team invite email", error);
  }
}
