import { Body, Container, Head, Html, Preview, Section, Text } from "@react-email/components";

type LinkMilestoneEmailProps = {
  userName?: string | null;
  linkAlias: string;
  linkName?: string | null;
  milestone: number;
  totalClicks: number;
};

export const LinkMilestoneEmail = ({
  userName,
  linkAlias,
  linkName,
  milestone,
  totalClicks,
}: LinkMilestoneEmailProps) => {
  const displayName = linkName || linkAlias;

  return (
    <Html>
      <Head />
      <Preview>Your link &quot;{displayName}&quot; just hit {milestone.toLocaleString()} clicks</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Text style={text}>Hi {userName || "there"},</Text>

            <Text style={text}>
              Your link <strong>{displayName}</strong> (ishortn.ink/{linkAlias}) just reached{" "}
              <strong>{totalClicks.toLocaleString()} clicks</strong>, passing your{" "}
              {milestone.toLocaleString()}-click milestone.
            </Text>

            <Text style={text}>
              You can view detailed analytics for this link in your dashboard.
            </Text>

            <Text style={text}>Thanks for using iShortn!</Text>
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

export default LinkMilestoneEmail;
