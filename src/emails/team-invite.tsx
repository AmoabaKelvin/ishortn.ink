import { Link, Text } from "@react-email/components";

import { displayName } from "@/lib/utils/user-name";

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
      <Text style={text}>Hi {displayName(recipientName) ?? "there"},</Text>

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
  inviteUrl: "https://ishortn.ink/teams/accept-invite?token=example-invite-token",
} satisfies TeamInviteEmailProps;

export default TeamInviteEmail;
