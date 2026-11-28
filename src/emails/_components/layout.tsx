import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";

import { getAppUrl } from "@/lib/constants/domains";
import { firstName } from "@/lib/utils/user-name";

import { RECIPIENT_TOKEN } from "./recipient";

import type { CSSProperties, ReactNode } from "react";

/** The postal address campaign emails carry; every email footer shows it. */
export const EMAIL_POSTAL_ADDRESS = "iShortn, Lauterbourg, Grand Est, France";

const LIFECYCLE_REASON =
  "You received this because product notification emails are on for your account.";

type EmailLayoutProps = {
  preview: string;
  children: ReactNode;
  /** Set on lifecycle and recurring emails so the footer offers a way to turn them off. */
  notificationSettingsUrl?: string;
  /** Why the recipient got it, shown after "Sent to …"; lifecycle emails default to notifications. */
  footerReason?: string;
  /** One-click unsubscribe page for this email alone; shown with or without the settings link. */
  unsubscribeUrl?: string | null;
} & (
  | {
      variant?: "system";
      /** Short uppercase label above the headline, e.g. "Weekly summary · 16-22 Nov". */
      eyebrow?: string;
      headline?: string;
    }
  | {
      /** Founder-voice emails: no eyebrow or headline, opens with "Hi {name},". */
      variant: "letter";
      recipientName: string | null | undefined;
    }
);

export function EmailLayout(props: EmailLayoutProps) {
  const { preview, children, notificationSettingsUrl, unsubscribeUrl } = props;
  const reason = props.footerReason ?? (notificationSettingsUrl ? LIFECYCLE_REASON : null);
  const dashboardUrl = getAppUrl("/dashboard");

  return (
    <Html lang="en">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </Head>
      <Preview>{preview}</Preview>
      <Body className="email-canvas" style={canvas}>
        <Container style={container}>
          {/* Header */}
          <Section className="email-header" style={header}>
            <Row>
              <Column style={logoCell}>
                {/* PNG, not SVG: most email clients block SVG images. The wordmark beside it is
                    live text, so the image is decorative. */}
                <Img
                  src={getAppUrl("/email/logo-tile@2x.png")}
                  alt=""
                  width="28"
                  height="28"
                  style={logo}
                />
              </Column>
              <Column>
                <Link href={dashboardUrl} className="email-wordmark" style={wordmark}>
                  iShortn
                </Link>
              </Column>
            </Row>
          </Section>

          {/* Card */}
          <table
            role="presentation"
            width="100%"
            cellPadding={0}
            cellSpacing={0}
            border={0}
            className="email-card"
            style={card}
          >
            <tbody>
              <tr>
                <td className="email-card-body" style={cardBody}>
                  {props.variant === "letter" ? (
                    <Text style={text}>Hi {firstName(props.recipientName) ?? "there"},</Text>
                  ) : (
                    <>
                      {props.eyebrow && <Text style={eyebrow}>{props.eyebrow}</Text>}
                      {props.headline && (
                        <Heading as="h1" className="email-headline" style={headline}>
                          {props.headline}
                        </Heading>
                      )}
                    </>
                  )}
                  {children}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Footer */}
          <Section className="email-footer" style={footer}>
            <Text style={footerText}>
              Sent to {RECIPIENT_TOKEN}. {reason}
              {(unsubscribeUrl || notificationSettingsUrl) && " "}
              {unsubscribeUrl && (
                <Link href={unsubscribeUrl} style={footerLink}>
                  Unsubscribe
                </Link>
              )}
              {unsubscribeUrl && notificationSettingsUrl && <> &middot; </>}
              {notificationSettingsUrl && (
                <Link href={notificationSettingsUrl} style={footerLink}>
                  Email settings
                </Link>
              )}
            </Text>
            <Text style={footerText}>
              Questions? Reply to this email.
              <br />
              {EMAIL_POSTAL_ADDRESS}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** The email's one primary action. A table cell carries the fill so Outlook draws it too. */
export function EmailButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      border={0}
      className="email-button"
      style={buttonTable}
    >
      <tbody>
        <tr>
          <td style={buttonCell}>
            <Link href={href} style={button}>
              {children}
            </Link>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** Grey panel for grouped data: counts, records, lists of items. */
export function Well({ children }: { children: ReactNode }) {
  return (
    <Section className="email-well" style={well}>
      {children}
    </Section>
  );
}

export function Signoff() {
  return (
    <>
      <Text style={text}>Thanks for using iShortn.</Text>
      <Text style={{ ...text, fontWeight: 500 }}>Kelvin &amp; the iShortn team</Text>
    </>
  );
}

/** For URLs and DNS values: monospace, and wraps anywhere so long values never widen the email. */
export function CodeBlock({ children }: { children: ReactNode }) {
  return (
    <Text className="email-code" style={codeBlock}>
      {children}
    </Text>
  );
}

export function Divider() {
  return <Hr className="email-divider" style={hr} />;
}

const fontFamily =
  '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
const wordmarkFontFamily = `"Google Sans","Inter",${fontFamily}`;
export const monoFontFamily = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

// Inline styles are the light theme. Clients that honour prefers-color-scheme (Apple Mail,
// Outlook for Mac, iOS) get the dark theme from this block; !important beats the inline styles.
// Template text has no classes, so the dark rules reach it through the card.
const css = `
:root { color-scheme: light dark; supported-color-schemes: light dark; }
@media only screen and (max-width: 480px) {
  .email-card-body { padding: 20px 20px 4px !important; }
  .email-headline { font-size: 22px !important; line-height: 28px !important; }
}
@media (prefers-color-scheme: dark) {
  .email-canvas { background-color: #0a0a0a !important; }
  .email-wordmark { color: #fafafa !important; }
  .email-card { background-color: #171717 !important; border-color: #262626 !important; }
  .email-card p, .email-card li, .email-card td, .email-card strong { color: #d4d4d4 !important; }
  .email-card a, .email-card .email-headline { color: #fafafa !important; }
  .email-card table, .email-card .email-divider { border-color: #262626 !important; }
  .email-card code { background-color: #262626 !important; color: #fafafa !important; }
  .email-card .email-well { background-color: #262626 !important; }
  .email-card .email-well table { border-color: #404040 !important; }
  .email-card .email-code { background-color: #0a0a0a !important; border-color: #262626 !important; color: #fafafa !important; }
  .email-card .email-warning { background-color: #451a03 !important; border-color: #92400e !important; }
  .email-card .email-warning p { color: #fbbf24 !important; }
  .email-card .email-button td { background-color: #ffffff !important; }
  .email-card .email-button a { color: #0a0a0a !important; }
  .email-footer p, .email-footer a { color: #a3a3a3 !important; }
}
`;

const canvas: CSSProperties = {
  backgroundColor: "#f5f5f5",
  fontFamily,
  margin: 0,
  padding: "0 12px",
};

const container: CSSProperties = {
  margin: "0 auto",
  padding: "32px 0 40px",
  width: "100%",
  maxWidth: "600px",
};

const header: CSSProperties = {
  margin: "0 0 16px",
};

const logoCell: CSSProperties = {
  width: "38px",
  verticalAlign: "middle",
};

const logo: CSSProperties = {
  borderRadius: "6px",
  display: "block",
};

const wordmark: CSSProperties = {
  color: "#171717",
  fontFamily: wordmarkFontFamily,
  fontSize: "19px",
  fontWeight: 700,
  letterSpacing: "-0.03em",
  lineHeight: "28px",
  textDecoration: "none",
};

const card: CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e8e8e8",
  borderCollapse: "separate",
  borderRadius: "16px",
};

// Bottom padding is short because every block ends with its own bottom margin.
const cardBody: CSSProperties = {
  padding: "32px 32px 16px",
};

const eyebrow: CSSProperties = {
  color: "#737373",
  fontFamily: monoFontFamily,
  fontSize: "12px",
  lineHeight: "16px",
  margin: "0 0 12px",
  textTransform: "uppercase",
};

const headline: CSSProperties = {
  color: "#171717",
  fontSize: "24px",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  lineHeight: "30px",
  margin: "0 0 16px",
};

const footer: CSSProperties = {
  padding: "24px 4px 0",
};

export const text: CSSProperties = {
  color: "#525252",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

export const smallText: CSSProperties = {
  color: "#737373",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0 0 16px",
};

export const headingText: CSSProperties = {
  color: "#171717",
  fontSize: "15px",
  fontWeight: 600,
  lineHeight: "24px",
  margin: "24px 0 8px",
};

export const link: CSSProperties = {
  color: "#171717",
  textDecoration: "underline",
  wordBreak: "break-all",
};

const well: CSSProperties = {
  backgroundColor: "#f5f5f5",
  borderRadius: "10px",
  padding: "12px 16px",
  margin: "0 0 16px",
};

export const panelItem: CSSProperties = {
  color: "#404040",
  fontSize: "14px",
  lineHeight: "20px",
  margin: "4px 0",
};

/** The headline figure inside a Well. */
export const bigNumber: CSSProperties = {
  color: "#171717",
  fontSize: "32px",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  lineHeight: "40px",
  margin: "0 0 4px",
};

const hr: CSSProperties = {
  borderColor: "#e8e8e8",
  margin: "24px 0",
};

const codeBlock: CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e8e8e8",
  borderRadius: "8px",
  color: "#171717",
  fontFamily: monoFontFamily,
  fontSize: "13px",
  lineHeight: "20px",
  margin: "4px 0 16px",
  padding: "8px 10px",
  wordBreak: "break-all",
};

const buttonTable: CSSProperties = {
  margin: "8px 0 24px",
};

// mso-padding-alt pads the cell in Outlook for Windows, which ignores padding on links.
const buttonCell = {
  backgroundColor: "#171717",
  borderRadius: "10px",
  msoPaddingAlt: "12px 20px",
} satisfies CSSProperties & { msoPaddingAlt: string };

const button: CSSProperties = {
  borderRadius: "10px",
  color: "#ffffff",
  display: "inline-block",
  fontFamily,
  fontSize: "15px",
  fontWeight: 600,
  lineHeight: "20px",
  padding: "12px 20px",
  textDecoration: "none",
};

const footerText: CSSProperties = {
  // #737373 is 4.4:1 on the #f5f5f5 canvas; this is the nearest grey that clears 4.5:1.
  color: "#6b6b6b",
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0 0 8px",
  overflowWrap: "anywhere",
};

const footerLink: CSSProperties = {
  color: "#6b6b6b",
  textDecoration: "underline",
};

export const recordTitle: CSSProperties = {
  color: "#171717",
  fontSize: "14px",
  fontWeight: 600,
  lineHeight: "20px",
  margin: "0 0 4px",
};

export const fieldLabel: CSSProperties = {
  color: "#737373",
  fontSize: "12px",
  lineHeight: "16px",
  margin: "10px 0 0",
};
