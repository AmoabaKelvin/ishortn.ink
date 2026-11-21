import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, Signoff, text } from "./_components/layout";

type TeamInviteAcceptedEmailProps = {
  inviterName?: string | null;
  memberName: string;
  memberEmail?: string | null;
  teamName: string;
  role: "admin" | "member";
  membersUrl: string;
};

export const TeamInviteAcceptedEmail = ({
  inviterName,
  memberName,
  memberEmail,
  teamName,
  role,
  membersUrl,
}: TeamInviteAcceptedEmailProps) => {
  const roleLabel = role === "admin" ? "an admin" : "a member";

  return (
    <EmailLayout preview={`${memberName} joined ${teamName} on iShortn`}>
      <Text style={text}>Hi {inviterName || "there"},</Text>

      <Text style={text}>
        <strong>{memberName}</strong>
        {memberEmail && memberEmail !== memberName ? ` (${memberEmail})` : ""} accepted your invite
        and joined <strong>{teamName}</strong> as {roleLabel}.
      </Text>

      <Text style={text}>You can change their role or remove them from the team at any time.</Text>

      <EmailButton href={membersUrl}>View team members</EmailButton>

      <Signoff />
    </EmailLayout>
  );
};

TeamInviteAcceptedEmail.PreviewProps = {
  inviterName: "Kofi",
  memberName: "Ama Owusu",
  memberEmail: "ama@example.com",
  teamName: "Acme Studio",
  role: "member",
  membersUrl: "https://acme.ishortn.ink/dashboard/teams/members",
} satisfies TeamInviteAcceptedEmailProps;

export default TeamInviteAcceptedEmail;
