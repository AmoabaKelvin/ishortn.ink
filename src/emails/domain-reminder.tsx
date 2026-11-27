import { Text } from "@react-email/components";

import { displayName } from "@/lib/utils/user-name";

import {
  CodeBlock,
  EmailButton,
  EmailLayout,
  fieldLabel,
  recordTitle,
  Signoff,
  smallText,
  text,
  Well,
} from "./_components/layout";

type Challenge = {
  type: "TXT" | "A" | "CNAME";
  domain: string;
  value: string;
};

type DomainReminderEmailProps = {
  recipientName?: string | null;
  domain: string;
  daysMisconfigured: number;
  challenges: Challenge[];
  dashboardUrl: string;
  notificationSettingsUrl: string;
};

export const DomainReminderEmail = ({
  recipientName,
  domain,
  daysMisconfigured,
  challenges,
  dashboardUrl,
  notificationSettingsUrl,
}: DomainReminderEmailProps) => {
  return (
    <EmailLayout
      preview={`${domain} needs configuration on iShortn`}
      notificationSettingsUrl={notificationSettingsUrl}
    >
      <Text style={text}>Hi {displayName(recipientName) ?? "there"},</Text>

      <Text style={text}>
        Your custom domain <strong>{domain}</strong> has been waiting for DNS configuration for{" "}
        <strong>
          {daysMisconfigured} {daysMisconfigured === 1 ? "day" : "days"}
        </strong>
        . Until the DNS is configured correctly, links using this domain won&apos;t work.
      </Text>

      <Text style={text}>Add the following DNS records at your domain provider:</Text>

      {/* One stacked block per record: tables overflow on narrow screens. */}
      {challenges.map((challenge, index) => (
        <Well key={`${challenge.type}-${challenge.domain}-${index}`}>
          <Text style={recordTitle}>{challenge.type} record</Text>
          <Text style={fieldLabel}>Name</Text>
          <CodeBlock>{challenge.domain}</CodeBlock>
          <Text style={fieldLabel}>Value</Text>
          <CodeBlock>{challenge.value}</CodeBlock>
        </Well>
      ))}

      <Text style={smallText}>
        DNS changes can take up to 48 hours to propagate. After adding these records, verify the
        configuration from your dashboard.
      </Text>

      <EmailButton href={dashboardUrl}>View domain settings</EmailButton>

      <Text style={text}>
        If you need help configuring your DNS, reply to this email and we&apos;ll assist you.
      </Text>

      <Signoff />
    </EmailLayout>
  );
};

DomainReminderEmail.PreviewProps = {
  recipientName: "Ama",
  domain: "go.acmestudio.com",
  daysMisconfigured: 12,
  challenges: [
    { type: "CNAME", domain: "go.acmestudio.com", value: "cname.ishortn.ink" },
    {
      type: "TXT",
      domain: "_cf-custom-hostname.go.acmestudio.com",
      value: "example-hostname-verification-value",
    },
    {
      type: "TXT",
      domain: "_acme-challenge.go.acmestudio.com",
      value: "example-acme-challenge-value-that-wraps-on-narrow-screens",
    },
  ],
  dashboardUrl: "https://acme.ishortn.ink/dashboard/domains",
  notificationSettingsUrl: "https://ishortn.ink/dashboard/settings#notifications",
} satisfies DomainReminderEmailProps;

export default DomainReminderEmail;
