import { Link, Text } from "@react-email/components";

import { EMAIL_LINKS, emailLinkUrl } from "@/lib/email/links";
import { displayName } from "@/lib/utils/user-name";

import { EmailButton, EmailLayout, link, text } from "./_components/layout";

type FirstLinkNudgeEmailProps = {
  userName?: string | null;
  createLinkUrl: string;
  createQrCodeUrl: string;
  notificationSettingsUrl: string;
};

export const FirstLinkNudgeEmail = ({
  userName,
  createLinkUrl,
  createQrCodeUrl,
  notificationSettingsUrl,
}: FirstLinkNudgeEmailProps) => {
  return (
    <EmailLayout
      preview="Paste a long URL and get a short link, a QR code and click counts."
      notificationSettingsUrl={notificationSettingsUrl}
    >
      <Text style={text}>Hi {displayName(userName) ?? "there"},</Text>

      <Text style={text}>
        Paste a long URL and iShortn gives you a short link to share, a QR code for it, and click
        counts, all on the free plan.
      </Text>

      <EmailButton href={createLinkUrl}>Create your first link</EmailButton>

      <Text style={text}>
        Prefer a QR code?{" "}
        <Link href={createQrCodeUrl} style={link}>
          Make one here
        </Link>
        .
      </Text>

      <Text style={{ ...text, fontWeight: 500 }}>The iShortn team</Text>
    </EmailLayout>
  );
};

FirstLinkNudgeEmail.PreviewProps = {
  userName: "Ama",
  createLinkUrl: emailLinkUrl(EMAIL_LINKS.firstLinkNudge.createLink),
  createQrCodeUrl: emailLinkUrl(EMAIL_LINKS.firstLinkNudge.createQrCode),
  notificationSettingsUrl: "https://ishortn.ink/dashboard/settings#notifications",
} satisfies FirstLinkNudgeEmailProps;

export default FirstLinkNudgeEmail;
