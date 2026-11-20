import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, Signoff, text } from "./_components/layout";

type TransferDeclinedEmailProps = {
  senderName?: string | null;
  recipientName: string;
  recipientEmail: string;
  transferSettingsUrl: string;
};

export const TransferDeclinedEmail = ({
  senderName,
  recipientName,
  recipientEmail,
  transferSettingsUrl,
}: TransferDeclinedEmailProps) => {
  return (
    <EmailLayout preview="Your iShortn transfer request was declined">
      <Text style={text}>Hi {senderName || "there"},</Text>

      <Text style={text}>
        Your resource transfer request to <strong>{recipientName}</strong> ({recipientEmail}) has
        been declined.
      </Text>

      <Text style={text}>
        Your resources remain in your account and have not been transferred. If you&apos;d like to
        transfer them to a different account, you can start a new transfer from your settings.
      </Text>

      <EmailButton href={transferSettingsUrl}>Open transfer settings</EmailButton>

      <Signoff />
    </EmailLayout>
  );
};

TransferDeclinedEmail.PreviewProps = {
  senderName: "Kofi",
  recipientName: "Ama Owusu",
  recipientEmail: "ama@example.com",
  transferSettingsUrl: "https://ishortn.ink/dashboard/settings#account-transfer",
} satisfies TransferDeclinedEmailProps;

export default TransferDeclinedEmail;
