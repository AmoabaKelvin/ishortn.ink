import { Body, Container, Head, Html, Preview, Section, Text } from "@react-email/components";

import type { Plan } from "@/lib/billing/plans";

type EventUsageAlertEmailProps = {
  userName?: string | null;
  threshold: number;
  limit: number;
  currentCount: number;
  plan: Plan;
};

export const EventUsageAlertEmail = ({
  userName,
  threshold,
  limit,
  currentCount,
  plan,
}: EventUsageAlertEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>You&apos;re nearing your monthly analytics cap</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Text style={text}>Hi {userName || "there"},</Text>

            <Text style={text}>
              Heads up: you&apos;ve used {currentCount} of your monthly analytics events on the{" "}
              {plan.toUpperCase()} plan ({threshold}% of the {limit.toLocaleString()} event limit).
            </Text>

            <Text style={text}>
              We&apos;ll keep redirecting your links, but analytics recording will pause if you hit
              100% of your limit. Upgrade anytime to raise or remove this cap.
            </Text>

            <Text style={text}>
              If this doesn&apos;t look right, reply to this email and we&apos;ll help out.
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

export default EventUsageAlertEmail;
