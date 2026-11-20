import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import { SUPPORT_EMAIL } from "@/lib/constants/app";
import { getAppUrl } from "@/lib/constants/domains";

import type { CSSProperties, ReactNode } from "react";

type EmailLayoutProps = {
  preview: string;
  children: ReactNode;
  /** Set on recurring notifications so the footer offers a way to turn them off. */
  notificationSettingsUrl?: string;
};

export function EmailLayout({ preview, children, notificationSettingsUrl }: EmailLayoutProps) {
  const dashboardUrl = getAppUrl("/dashboard");

  return (
    <Html lang="en">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Link href={dashboardUrl} style={wordmark}>
              iShortn
            </Link>
          </Section>

          <Section style={content}>{children}</Section>

          <Hr style={hr} />

          <Section style={footer}>
            <Text style={footerText}>
              iShortn &middot;{" "}
              <Link href={dashboardUrl} style={footerLink}>
                Dashboard
              </Link>{" "}
              &middot;{" "}
              <Link href={`mailto:${SUPPORT_EMAIL}`} style={footerLink}>
                {SUPPORT_EMAIL}
              </Link>
            </Text>
            {notificationSettingsUrl && (
              <Text style={footerText}>
                You received this because product notification emails are on for your account.{" "}
                <Link href={notificationSettingsUrl} style={footerLink}>
                  Manage notifications
                </Link>
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function EmailButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Section style={buttonContainer}>
      <Button href={href} style={button}>
        {children}
      </Button>
    </Section>
  );
}

export function Signoff() {
  return (
    <>
      <Text style={text}>Thanks for using iShortn!</Text>
      <Text style={{ ...text, fontWeight: 500 }}>Kelvin &amp; the iShortn team</Text>
    </>
  );
}

/** For URLs and DNS values: monospace, and wraps anywhere so long values never widen the email. */
export function CodeBlock({ children }: { children: ReactNode }) {
  return <Text style={codeBlock}>{children}</Text>;
}

const fontFamily =
  '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif';

const main: CSSProperties = {
  backgroundColor: "#ffffff",
  fontFamily,
  margin: 0,
};

const container: CSSProperties = {
  margin: "0 auto",
  padding: "24px 0 40px",
  width: "100%",
  maxWidth: "560px",
};

const header: CSSProperties = {
  padding: "0 24px",
};

const wordmark: CSSProperties = {
  color: "#111827",
  fontSize: "20px",
  fontWeight: 600,
  letterSpacing: "-0.02em",
  textDecoration: "none",
};

const content: CSSProperties = {
  padding: "8px 24px 0",
};

const footer: CSSProperties = {
  padding: "0 24px",
};

export const text: CSSProperties = {
  color: "#333333",
  fontSize: "16px",
  lineHeight: "24px",
};

export const smallText: CSSProperties = {
  color: "#666666",
  fontSize: "14px",
  lineHeight: "20px",
};

export const headingText: CSSProperties = {
  color: "#111827",
  fontSize: "16px",
  fontWeight: 600,
  lineHeight: "24px",
  marginTop: "16px",
  marginBottom: "8px",
};

export const link: CSSProperties = {
  color: "#2563eb",
  textDecoration: "underline",
  wordBreak: "break-all",
};

export const panel: CSSProperties = {
  backgroundColor: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "12px 16px",
  margin: "16px 0",
};

export const panelItem: CSSProperties = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "20px",
  margin: "4px 0",
};

export const hr: CSSProperties = {
  borderColor: "#e5e7eb",
  margin: "24px 0",
};

const codeBlock: CSSProperties = {
  backgroundColor: "#f3f4f6",
  borderRadius: "6px",
  color: "#111827",
  fontFamily: "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "4px 0 0",
  padding: "8px 10px",
  wordBreak: "break-all",
};

const buttonContainer: CSSProperties = {
  margin: "24px 0",
};

const button: CSSProperties = {
  backgroundColor: "#111827",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: 500,
  padding: "12px 20px",
  textAlign: "center",
  textDecoration: "none",
};

const footerText: CSSProperties = {
  color: "#9ca3af",
  fontSize: "12px",
  lineHeight: "18px",
  margin: "4px 0",
};

const footerLink: CSSProperties = {
  color: "#6b7280",
  textDecoration: "underline",
};

export const recordTitle: CSSProperties = {
  color: "#111827",
  fontSize: "14px",
  fontWeight: 600,
  lineHeight: "20px",
  margin: "0 0 4px",
};

export const fieldLabel: CSSProperties = {
  color: "#6b7280",
  fontSize: "12px",
  lineHeight: "16px",
  margin: "10px 0 0",
};
