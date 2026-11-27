import { Link, Text } from "@react-email/components";

import { EMAIL_LINKS, emailLinkUrl } from "@/lib/email/links";

import { EmailButton, EmailLayout, link, text } from "./_components/layout";

import type { CSSProperties } from "react";

type WelcomeEmailProps = {
  userName: string | null;
  /** First name of the sender (EMAIL_FROM_FIRST_NAME); null signs off as the team. */
  founderName: string | null;
};

export const WelcomeEmail = ({ userName, founderName }: WelcomeEmailProps) => (
  <EmailLayout
    variant="letter"
    recipientName={userName}
    preview="Paste a long URL, get a short link and a QR code. Here is where to start."
    footerReason="You received this because you created an iShortn account."
  >
    <Text style={text}>
      Thanks for signing up. iShortn turns long URLs into short links you can share, with a QR code
      for each one and a count of every click.
    </Text>
    <Text style={text}>
      The best first step is to create a link. Paste any URL and you will have a short link in a few
      seconds.
    </Text>
    <EmailButton href={emailLinkUrl(EMAIL_LINKS.welcome.createLink)}>Create a link</EmailButton>
    <Text style={text}>
      When you are ready, you can put your links on{" "}
      <Link href={emailLinkUrl(EMAIL_LINKS.welcome.customDomains)} style={wordLink}>
        your own domain
      </Link>{" "}
      or{" "}
      <Link href={emailLinkUrl(EMAIL_LINKS.welcome.qrCodes)} style={wordLink}>
        design a QR code
      </Link>{" "}
      for print.
    </Text>
    <Text style={text}>
      If anything is unclear or missing, reply to this email. A person reads every reply.
    </Text>
    {founderName ? (
      <Text style={text}>
        {founderName}
        <br />
        Founder, iShortn
      </Text>
    ) : (
      <Text style={{ ...text, fontWeight: 500 }}>The iShortn team</Text>
    )}
  </EmailLayout>
);

WelcomeEmail.PreviewProps = {
  userName: "Ama Osei",
  founderName: "Kelvin",
} satisfies WelcomeEmailProps;

export default WelcomeEmail;

// `link` breaks anywhere so raw URLs fit; these links are words, so they wrap between words.
const wordLink: CSSProperties = { ...link, wordBreak: "normal" };
