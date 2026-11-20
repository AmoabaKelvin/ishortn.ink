import { Link, Text } from "@react-email/components";

import { EmailButton, EmailLayout, link, Signoff, smallText, text } from "./_components/layout";

type TeamInviteEmailProps = {
  recipientName?: string | null;
  teamName: string;
  inviterName: string;
  role: "admin" | "member";
  inviteUrl: string;
};

export const TeamInviteEmail = ({
  recipientName,
  teamName,
  inviterName,
  role,
  inviteUrl,
}: TeamInviteEmailProps) => {
  const roleLabel = role === "admin" ? "an admin" : "a member";

  return (
    <EmailLayout preview={`${inviterName} invited you to join ${teamName} on iShortn`}>
      <Text style={text}>Hi {recipientName || "there"},</Text>

      <Text style={text}>
        {inviterName} has invited you to join <strong>{teamName}</strong> as {roleLabel} on iShortn.
      </Text>

      <Text style={text}>
        As a team member, you&apos;ll be able to create and manage links, view analytics, and
        collaborate with your team.
      </Text>

      <EmailButton href={inviteUrl}>Accept invitation</EmailButton>

      <Text style={smallText}>
        Or copy and paste this URL into your browser:{" "}
        <Link href={inviteUrl} style={link}>
          {inviteUrl}
        </Link>
      </Text>

      <Text style={smallText}>
        This invitation will expire in 7 days. If you don&apos;t want to join this team, you can
        safely ignore this email.
      </Text>

      <Signoff />
    </EmailLayout>
  );
};

TeamInviteEmail.PreviewProps = {
  recipientName: "Ama",
  teamName: "Acme Studio",
  inviterName: "Kofi Mensah",
  role: "member",
  inviteUrl: "https://ishortn.ink/teams/accept-invite?token=3f9a1c0e7b2d4a6f8e1c3b5d7f9a1c3e",
} satisfies TeamInviteEmailProps;

export default TeamInviteEmail;
