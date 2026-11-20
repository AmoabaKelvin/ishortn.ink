import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type ApiAccessSunsetEmailProps = {
  userName?: string | null;
  /** Formatted cutoff, e.g. "November 28, 2026 at 12:00 PM UTC". */
  sunsetDate: string;
  upgradeUrl: string;
  kind: "notice" | "reminder";
};

export const ApiAccessSunsetEmail = ({
  userName,
  sunsetDate,
  upgradeUrl,
  kind,
}: ApiAccessSunsetEmailProps) => {
  const preview =
    kind === "reminder"
      ? `Your iShortn API key stops working on ${sunsetDate}`
      : "API access is moving to the Pro plan";

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Text style={text}>Hi {userName || "there"},</Text>

            {kind === "reminder" ? (
              <Text style={text}>
                A reminder that the API key on your iShortn account stops working on{" "}
                <strong>{sunsetDate}</strong>, about 24 hours from now. After that, API requests
                with it will return an error until the account is on Pro or Ultra.
              </Text>
            ) : (
              <Text style={text}>
                The iShortn REST API is now part of the Pro and Ultra plans. Your account has an API
                key but isn&apos;t on a paid plan, so the key keeps working on Free limits until{" "}
                <strong>{sunsetDate}</strong> and then stops.
              </Text>
            )}

            <Text style={text}>
              Upgrading keeps your existing key working with no changes to your integration, and
              raises your API rate limits.
            </Text>

            <Section style={buttonContainer}>
              <Button style={button} href={upgradeUrl}>
                See plans
              </Button>
            </Section>

            <Text style={smallText}>
              Or copy this link:{" "}
              <Link href={upgradeUrl} style={linkText}>
                {upgradeUrl}
              </Link>
            </Text>

            <Text style={text}>
              Links you already created keep redirecting either way. Questions? Reply to this email.
            </Text>

            <Text style={{ ...text, fontWeight: 500 }}>Kelvin & the iShortn team</Text>
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

const smallText = {
  color: "#666",
  fontSize: "14px",
  lineHeight: "20px",
  marginTop: "16px",
};

const linkText = {
  color: "#2563eb",
  wordBreak: "break-all" as const,
};

const buttonContainer = {
  textAlign: "center" as const,
  marginTop: "24px",
  marginBottom: "24px",
};

const button = {
  backgroundColor: "#111827",
  borderRadius: "6px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: 500,
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 24px",
};

export default ApiAccessSunsetEmail;
