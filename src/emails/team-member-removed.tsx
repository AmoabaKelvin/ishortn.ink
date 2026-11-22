import { Text } from "@react-email/components";

import { displayName } from "@/lib/utils/user-name";

import { EmailButton, EmailLayout, Signoff, text } from "./_components/layout";

type TeamMemberRemovedEmailProps = {
  memberName?: string | null;
  teamName: string;
  dashboardUrl: string;
};

export const TeamMemberRemovedEmail = ({
  memberName,
  teamName,
  dashboardUrl,
}: TeamMemberRemovedEmailProps) => {
  return (
    <EmailLayout preview={`You were removed from ${teamName} on iShortn`}>
      <Text style={text}>Hi {displayName(memberName) ?? "there"},</Text>

      <Text style={text}>
        You&apos;ve been removed from the <strong>{teamName}</strong> team on iShortn, so you no
        longer have access to its links, domains or analytics.
      </Text>

      <Text style={text}>
        Your personal workspace and everything in it is unaffected. If you think this was a mistake,
        contact a team admin.
      </Text>

      <EmailButton href={dashboardUrl}>Go to your dashboard</EmailButton>

      <Signoff />
    </EmailLayout>
  );
};

TeamMemberRemovedEmail.PreviewProps = {
  memberName: "Ama",
  teamName: "Acme Studio",
  dashboardUrl: "https://ishortn.ink/dashboard",
} satisfies TeamMemberRemovedEmailProps;

export default TeamMemberRemovedEmail;
