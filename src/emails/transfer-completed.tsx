import { Text } from "@react-email/components";

import { displayName } from "@/lib/utils/user-name";

import { EmailButton, EmailLayout, headingText, Signoff, text } from "./_components/layout";
import { ResourceList } from "./_components/resource-list";

import type { ResourceCounts } from "@/server/api/routers/account-transfer/account-transfer.service";

type TransferCompletedEmailProps = {
  senderName?: string | null;
  recipientName: string;
  recipientEmail: string;
  resourceCounts: ResourceCounts;
  dashboardUrl: string;
};

export const TransferCompletedEmail = ({
  senderName,
  recipientName,
  recipientEmail,
  resourceCounts,
  dashboardUrl,
}: TransferCompletedEmailProps) => {
  return (
    <EmailLayout preview="Your iShortn resources have been transferred">
      <Text style={text}>Hi {displayName(senderName) ?? "there"},</Text>

      <Text style={text}>
        Your resource transfer to <strong>{recipientName}</strong> ({recipientEmail}) has been
        completed.
      </Text>

      <Text style={headingText}>Resources transferred</Text>
      <ResourceList counts={resourceCounts} emptyLabel="No resources transferred" />

      <Text style={text}>
        These resources are now owned by {recipientName} and have been removed from your account.
      </Text>

      <EmailButton href={dashboardUrl}>Go to your dashboard</EmailButton>

      <Signoff />
    </EmailLayout>
  );
};

TransferCompletedEmail.PreviewProps = {
  senderName: "Kofi",
  recipientName: "Ama Owusu",
  recipientEmail: "ama@example.com",
  resourceCounts: {
    links: 1240,
    customDomains: 2,
    qrCodes: 18,
    folders: 4,
    tags: 1,
    utmTemplates: 0,
    qrPresets: 3,
  },
  dashboardUrl: "https://ishortn.ink/dashboard",
} satisfies TransferCompletedEmailProps;

export default TransferCompletedEmail;
