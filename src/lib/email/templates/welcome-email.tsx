import { Link, Text } from "@react-email/components";

import {
  Divider,
  EmailButton,
  EmailLayout,
  link,
  smallText,
  text,
} from "@/emails/_components/layout";
import { EMAIL_LINKS, emailLinkUrl } from "@/lib/email/links";

import type { CSSProperties } from "react";

interface WelcomeEmailProps {
  userName: string | null;
}

export const CREATE_LINK_URL = emailLinkUrl(EMAIL_LINKS.welcome.createLink);

const nextSteps = [
  { label: "Make a QR code for a link", href: emailLinkUrl(EMAIL_LINKS.welcome.qrCodes) },
  {
    label: "Use your own custom domain (Pro)",
    href: emailLinkUrl(EMAIL_LINKS.welcome.customDomains),
  },
  { label: "Build a link-in-bio page", href: emailLinkUrl(EMAIL_LINKS.welcome.bioPages) },
];

export const WelcomeEmail = ({ userName }: WelcomeEmailProps) => (
  <EmailLayout
    variant="letter"
    recipientName={userName}
    preview="Shorten your first link in under a minute"
    footerReason="You received this because you created an iShortn account."
  >
    <Text style={text}>Welcome to iShortn!</Text>
    <Text style={text}>
      The best place to start is your first short link. Paste a long URL and you get a short link
      you can share and track in under a minute.
    </Text>
    <EmailButton href={CREATE_LINK_URL}>Shorten your first link</EmailButton>
    <Text style={text}>Then try:</Text>
    <ul style={list}>
      {nextSteps.map((step) => (
        <li key={step.href} style={listItem}>
          <Link href={step.href} style={link}>
            {step.label}
          </Link>
        </li>
      ))}
    </ul>
    <Text style={text}>
      If you have a question or a feature request, feel free to reach out to me at{" "}
      <Link href="mailto:kelvin@ishortn.ink" style={link}>
        kelvin@ishortn.ink
      </Link>
    </Text>
    <Text style={text}>
      Best,
      <br />
      Kelvin Amoaba
      <br />
      iShortn Developer
    </Text>
    <Divider />
    <Text style={smallText}>
      In case you need an engineer on your team or a freelancer, I am available for hire. You can
      check out my portfolio at{" "}
      <Link href="https://kelvinamoaba.com" style={link}>
        kelvinamoaba.com
      </Link>
    </Text>
  </EmailLayout>
);

WelcomeEmail.PreviewProps = {
  userName: "Kelvin Amoaba",
} satisfies WelcomeEmailProps;

export default WelcomeEmail;

const list: CSSProperties = {
  margin: "0 0 16px",
  paddingLeft: "20px",
};

const listItem: CSSProperties = {
  ...text,
  margin: "0 0 4px",
};
