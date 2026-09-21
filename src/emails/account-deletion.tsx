import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

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
    <Html>
      <Head />
      <Preview>Your iShortn account is scheduled for deletion</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Text style={text}>Hi {userName || "there"},</Text>

            <Text style={text}>
              Your iShortn account has been scheduled for deletion. Your short links and bio pages
              have stopped working, and you no longer have access to the dashboard or the API.
            </Text>

            <Text style={text}>
              Everything is kept until <strong>{purgeDate}</strong>. After that date your links, QR
              codes, analytics, and settings are permanently deleted and cannot be recovered.
            </Text>

            <Hr style={hr} />

            <Text style={text}>
              Changed your mind, or didn&apos;t do this yourself? Sign in before {purgeDate} and
              restore your account — your links, bio pages, and analytics all come back. A paid
              subscription stays cancelled, so you&apos;d need to subscribe again.
            </Text>

            <Text style={text}>
              <Link href={restoreUrl} style={link}>
                Restore my account
              </Link>
            </Text>

            <Hr style={hr} />

            <Text style={text}>
              If you have questions, just reply to this email or reach us at support@ishortn.ink.
            </Text>
            <Text style={{ ...text, fontWeight: 500 }}>Kelvin &amp; the iShortn team</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: "#ffffff",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "20px 0 48px",
  maxWidth: "560px",
};

const section = {
  padding: "24px",
};

const text = {
  color: "#333",
  fontSize: "16px",
  lineHeight: "24px",
};

const link = {
  color: "#2563eb",
  fontSize: "16px",
  textDecoration: "underline",
};

const hr = {
  borderColor: "#e5e7eb",
  marginTop: "24px",
  marginBottom: "24px",
};

export default AccountDeletionEmail;
