import { Text } from "@react-email/components";

import { displayName } from "@/lib/utils/user-name";

import { EmailButton, EmailLayout, Signoff, text } from "./_components/layout";

type LinkMilestoneEmailProps = {
  userName?: string | null;
  shortUrl: string;
  linkName?: string | null;
  milestone: number;
  totalClicks: number;
  analyticsUrl: string;
  notificationSettingsUrl: string;
};

export const LinkMilestoneEmail = ({
  userName,
  shortUrl,
  linkName,
  milestone,
  totalClicks,
  analyticsUrl,
  notificationSettingsUrl,
}: LinkMilestoneEmailProps) => {
  return (
    <EmailLayout
      preview={`${linkName || shortUrl} just hit ${milestone.toLocaleString()} clicks`}
      notificationSettingsUrl={notificationSettingsUrl}
    >
      <Text style={text}>Hi {displayName(userName) ?? "there"},</Text>

      <Text style={text}>
        {linkName ? (
          <>
            Your link <strong>{linkName}</strong> ({shortUrl})
          </>
        ) : (
          <>
            Your link <strong>{shortUrl}</strong>
          </>
        )}{" "}
        just reached <strong>{totalClicks.toLocaleString()} clicks</strong>, passing your{" "}
        {milestone.toLocaleString()}-click milestone.
      </Text>

      <EmailButton href={analyticsUrl}>View link analytics</EmailButton>

      <Signoff />
    </EmailLayout>
  );
};

LinkMilestoneEmail.PreviewProps = {
  userName: "Ama",
  shortUrl: "go.acmestudio.com/spring-launch-2026",
  linkName: "Spring launch newsletter",
  milestone: 10000,
  totalClicks: 10012,
  analyticsUrl:
    "https://ishortn.ink/dashboard/analytics/spring-launch-2026?domain=go.acmestudio.com",
  notificationSettingsUrl: "https://ishortn.ink/dashboard/settings#notifications",
} satisfies LinkMilestoneEmailProps;

export default LinkMilestoneEmail;
