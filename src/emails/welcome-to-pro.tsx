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

import type { Plan } from "@/lib/billing/plans";

interface WelcomeEmailProps {
  userName?: string;
  plan?: Exclude<Plan, "free">;
  supportEmail?: string;
  senderName?: string;
}

const planDisplayNames: Record<Exclude<Plan, "free">, string> = {
  pro: "Pro",
  ultra: "Ultra",
};

const planBenefits: Record<Exclude<Plan, "free">, string[]> = {
  pro: [
    "10,000 monthly link events",
    "Up to 1,000 short links",
    "5 custom folders for organization",
    "3 custom domains",
    "Extended analytics history",
  ],
  ultra: [
    "Unlimited link events",
    "Unlimited short links",
    "Unlimited folders",
    "Unlimited custom domains",
    "Full analytics history",
    "Priority support",
  ],
};

export const WelcomeEmail = ({
  userName = "there",
  plan = "pro",
  supportEmail = "support@ishortn.ink",
  senderName = "Kelvin",
}: WelcomeEmailProps) => {
  const displayName = planDisplayNames[plan];
  const benefits = planBenefits[plan];

  return (
    <Html>
      <Head />
      <Preview>Welcome to iShortn {displayName}!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Text style={heading}>Welcome to iShortn {displayName}! 🎉</Text>

            <Text style={text}>Hi {userName},</Text>

            <Text style={text}>
              Thank you for upgrading to iShortn {displayName}! Your account has
              been successfully upgraded, and you now have access to all{" "}
              {displayName} features.
            </Text>

            <Text style={subheading}>What's included in your plan:</Text>

            <Section style={benefitsList}>
              {benefits.map((benefit, index) => (
                <Text key={index} style={benefitItem}>
                  ✓ {benefit}
                </Text>
              ))}
            </Section>

            <Section style={ctaContainer}>
              <Button style={button} href="https://ishortn.ink/dashboard">
                Go to Dashboard
              </Button>
            </Section>

            <Hr style={hr} />

            <Text style={text}>
              If you have any questions or need help getting started, feel free
              to reply to this email or reach out at{" "}
              <Link href={`mailto:${supportEmail}`} style={link}>
                {supportEmail}
              </Link>
              .
            </Text>

            <Text style={text}>
              Thanks for choosing iShortn!
            </Text>

            <Text style={signature}>
              {senderName}
              <br />
              <span style={signatureRole}>iShortn Team</span>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "20px 0 48px",
  maxWidth: "560px",
};

const section = {
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  padding: "32px",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
};

const heading = {
  color: "#1a1a1a",
  fontSize: "24px",
  fontWeight: "600" as const,
  lineHeight: "32px",
  marginBottom: "24px",
  textAlign: "center" as const,
};

const subheading = {
  color: "#1a1a1a",
  fontSize: "16px",
  fontWeight: "600" as const,
  lineHeight: "24px",
  marginTop: "24px",
  marginBottom: "12px",
};

const text = {
  color: "#4a4a4a",
  fontSize: "16px",
  lineHeight: "26px",
  marginBottom: "16px",
};

const benefitsList = {
  backgroundColor: "#f8fafc",
  borderRadius: "6px",
  padding: "16px 20px",
  marginBottom: "24px",
};

const benefitItem = {
  color: "#2d3748",
  fontSize: "15px",
  lineHeight: "28px",
  margin: "0",
};

const ctaContainer = {
  textAlign: "center" as const,
  marginTop: "24px",
  marginBottom: "24px",
};

const button = {
  backgroundColor: "#5F51E8",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600" as const,
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "14px 28px",
};

const hr = {
  borderColor: "#e5e7eb",
  margin: "24px 0",
};

const link = {
  color: "#5F51E8",
  textDecoration: "underline",
};

const signature = {
  color: "#4a4a4a",
  fontSize: "16px",
  lineHeight: "24px",
  marginTop: "24px",
};

const signatureRole = {
  color: "#6b7280",
  fontSize: "14px",
};

export default WelcomeEmail;
