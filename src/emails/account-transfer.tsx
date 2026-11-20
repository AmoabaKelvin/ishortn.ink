import { Link, Text } from "@react-email/components";

import {
  EmailButton,
  EmailLayout,
  headingText,
  link,
  Signoff,
  smallText,
  text,
} from "./_components/layout";
import { ResourceList } from "./_components/resource-list";

import type { ResourceCounts } from "@/server/api/routers/account-transfer/account-transfer.service";

type AccountTransferEmailProps = {
  recipientName?: string | null;
  senderName: string;
  senderEmail: string;
  acceptUrl: string;
  resourceCounts: ResourceCounts;
};

export const AccountTransferEmail = ({
  recipientName,
  senderName,
  senderEmail,
  acceptUrl,
  resourceCounts,
}: AccountTransferEmailProps) => {
  return (
    <EmailLayout preview={`${senderName} wants to transfer their iShortn resources to you`}>
      <Text style={text}>Hi {recipientName || "there"},</Text>

      <Text style={text}>
        <strong>{senderName}</strong> ({senderEmail}) has requested to transfer their iShortn
        resources to your account.
      </Text>

      <Text style={headingText}>Resources to be transferred</Text>
      <ResourceList counts={resourceCounts} emptyLabel="No resources to transfer" />

      <Text style={headingText}>Good to know</Text>
      <Text style={smallText}>
        All analytics data is preserved. Folders and tags are merged by name if you already have
        them. API tokens and subscriptions are not transferred.
      </Text>

      <EmailButton href={acceptUrl}>Review and accept transfer</EmailButton>

      <Text style={smallText}>
        Or copy and paste this URL into your browser:{" "}
        <Link href={acceptUrl} style={link}>
          {acceptUrl}
        </Link>
      </Text>

      <Text style={smallText}>
        This request will expire in 7 days. If you don&apos;t want to accept this transfer, you can
        safely ignore this email.
      </Text>

      <Signoff />
    </EmailLayout>
  );
};

AccountTransferEmail.PreviewProps = {
  recipientName: "Ama",
  senderName: "Kofi Mensah",
  senderEmail: "kofi@example.com",
  acceptUrl: "https://ishortn.ink/account/accept-transfer?token=8c1e4b7a2f9d3c6e0a5b8d1f4c7e0a3b",
  resourceCounts: {
    links: 1240,
    customDomains: 2,
    qrCodes: 18,
    folders: 4,
    tags: 1,
    utmTemplates: 0,
    qrPresets: 3,
  },
} satisfies AccountTransferEmailProps;

export default AccountTransferEmail;
