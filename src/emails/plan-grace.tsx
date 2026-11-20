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

export type PlanGraceEmailProps = {
  recipientName?: string | null;
  kind: "started" | "reminder" | "ended";
  /** lapsed: the subscription ended; over_plan: features above the plan; team: owner not on Ultra. */
  reason: "lapsed" | "over_plan" | "team";
  /** The plan that keeps everything working. */
  planName: string;
  endsOn: string;
  timeLeft: string;
  teamName?: string;
  /** What stops being available (already phrased). */
  items: string[];
  upgradeUrl: string;
};

function intro({ kind, reason, planName, endsOn, timeLeft, teamName }: PlanGraceEmailProps) {
  if (reason === "team") {
    return kind === "started"
      ? `Team workspaces are part of the Ultra plan, and the owner of ${teamName} isn't on Ultra right now. The team keeps working as usual until ${endsOn}. After that it becomes read-only for every member: no new links, domains, edits or invites.`
      : `${timeLeft} left: on ${endsOn}, ${teamName} becomes read-only for every member (no new links, domains, edits or invites) unless its owner is on Ultra.`;
  }
  if (reason === "lapsed") {
    if (kind === "ended") {
      return `Your ${planName} access has ended and your account is on the Free plan now. These features can't be added or changed any more:`;
    }
    return kind === "started"
      ? `Your iShortn ${planName} subscription has ended or its last payment didn't go through. You keep ${planName} until ${endsOn}. After that, Free plan limits apply:`
      : `${timeLeft} left: your ${planName} access ends on ${endsOn}. After that, Free plan limits apply:`;
  }
  return kind === "started"
    ? `Your account uses features that aren't part of your current plan. They keep working as they are until ${endsOn}. After that they can't be added or changed:`
    : `${timeLeft} left: from ${endsOn}, these features can't be added or changed on your current plan:`;
}

export const PlanGraceEmail = (props: PlanGraceEmailProps) => {
  const { recipientName, kind, reason, planName, items, upgradeUrl } = props;

  return (
    <Html>
      <Head />
      <Preview>
        {reason === "team"
          ? `${props.teamName} needs its owner on Ultra`
          : kind === "ended"
            ? "Your account is on the Free plan now"
            : `Keep your ${planName} features after ${props.endsOn}`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Text style={text}>Hi {recipientName || "there"},</Text>

            <Text style={text}>{intro(props)}</Text>

            {items.length > 0 && (
              <ul style={list}>
                {items.map((item) => (
                  <li key={item} style={listItem}>
                    {item}
                  </li>
                ))}
              </ul>
            )}

            <Text style={text}>
              Your links keep redirecting with their current settings, and nothing is deleted.{" "}
              {kind === "ended"
                ? `Upgrading to ${planName} restores everything straight away.`
                : `Upgrade to ${planName} to keep everything as it is. Upgrading later restores it straight away.`}
            </Text>

            <Section style={buttonContainer}>
              <Button style={button} href={upgradeUrl}>
                Upgrade to {planName}
              </Button>
            </Section>

            <Text style={smallText}>
              Or copy and paste this URL into your browser:{" "}
              <span style={linkText}>{upgradeUrl}</span>
            </Text>

            <Text style={text}>Questions? Reply to this email and we&apos;ll help.</Text>

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

const list = {
  color: "#333",
  fontSize: "15px",
  lineHeight: "24px",
  paddingLeft: "20px",
};

const listItem = {
  marginBottom: "4px",
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

export default PlanGraceEmail;
