import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type TeamInviteEmailProps = {
  recipientName?: string | null;
  teamName: string;
  teamSlug: string;
  inviterName: string;
  role: "admin" | "member";
  inviteUrl: string;
};

export const TeamInviteEmail = ({
  recipientName,
  teamName,
  teamSlug,
  inviterName,
  role,
  inviteUrl,
}: TeamInviteEmailProps) => {
  const roleLabel = role === "admin" ? "an admin" : "a member";

  return (
    <Html>
      <Head />
      <Preview>
        {inviterName} invited you to join {teamName} on iShortn
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Text style={text}>Hi {recipientName || "there"},</Text>

            <Text style={text}>
              {inviterName} has invited you to join <strong>{teamName}</strong> as{" "}
              {roleLabel} on iShortn.
            </Text>

            <Text style={text}>
              As a team member, you&apos;ll be able to create and manage links, view
              analytics, and collaborate with your team.
            </Text>

            <Section style={buttonContainer}>
              <Button style={button} href={inviteUrl}>
                Accept Invitation
              </Button>
            </Section>

            <Text style={smallText}>
              Or copy and paste this URL into your browser:{" "}
              <span style={linkText}>{inviteUrl}</span>
            </Text>

            <Text style={smallText}>
              This invitation will expire in 7 days. If you don&apos;t want to join
              this team, you can safely ignore this email.
            </Text>

            <Text style={text}>Thanks for using iShortn!</Text>
            <Text style={{ ...text, fontWeight: 500 }}>
              Kelvin & the iShortn team
            </Text>
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

export default TeamInviteEmail;
