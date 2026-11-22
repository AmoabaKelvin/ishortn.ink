import { Text } from "@react-email/components";

import { SUPPORT_EMAIL } from "@/lib/constants/app";
import { displayName } from "@/lib/utils/user-name";

import { EmailButton, EmailLayout, text } from "./_components/layout";

type AccountDeletionEmailProps = {
  userName?: string | null;
  purgeDate: string;
  restoreUrl: string;
};

export const AccountDeletionEmail = ({
  userName,
  purgeDate,
  restoreUrl,
}: AccountDeletionEmailProps) => {
  return (
    <EmailLayout preview="Your iShortn account is scheduled for deletion">
      <Text style={text}>Hi {displayName(userName) ?? "there"},</Text>

      <Text style={text}>
        Your iShortn account has been scheduled for deletion. Your short links and bio pages have
        stopped working, and you no longer have access to the dashboard or the API.
      </Text>

      <Text style={text}>
        Everything is kept until <strong>{purgeDate}</strong>. After that date your links, QR codes,
        analytics, and settings are permanently deleted and cannot be recovered.
      </Text>

      <Text style={text}>
        Changed your mind, or didn&apos;t do this yourself? Sign in before {purgeDate} and restore
        your account — your links, bio pages, and analytics all come back. A paid subscription stays
        cancelled, so you&apos;d need to subscribe again.
      </Text>

      <EmailButton href={restoreUrl}>Restore my account</EmailButton>

      <Text style={text}>
        If you have questions, just reply to this email or reach us at {SUPPORT_EMAIL}.
      </Text>
      <Text style={{ ...text, fontWeight: 500 }}>Kelvin &amp; the iShortn team</Text>
    </EmailLayout>
  );
};

AccountDeletionEmail.PreviewProps = {
  userName: "Ama",
  purgeDate: "December 20, 2026",
  restoreUrl: "https://ishortn.ink/dashboard",
} satisfies AccountDeletionEmailProps;

export default AccountDeletionEmail;
