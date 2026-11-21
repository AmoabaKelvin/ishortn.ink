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
import { render } from "@react-email/render";

interface WelcomeEmailProps {
  userFirstname: string;
}

const UTM = "utm_source=email&utm_medium=lifecycle&utm_campaign=welcome";

export const CREATE_LINK_URL = `https://ishortn.ink/dashboard/link/new?${UTM}`;

const nextSteps = [
  { label: "Make a QR code for a link", href: `https://ishortn.ink/docs/qr-codes?${UTM}` },
  {
    label: "Use your own custom domain (Pro)",
    href: `https://ishortn.ink/docs/custom-domains?${UTM}`,
  },
  { label: "Build a link-in-bio page", href: `https://ishortn.ink/docs/bio-pages?${UTM}` },
];

export const WelcomeEmail = ({ userFirstname }: WelcomeEmailProps) => (
  <Html>
    <Head />
    <Preview>Shorten your first link in under a minute</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={paragraph}>Hi {userFirstname ? userFirstname : "there"},</Text>
        <Text style={paragraph}>Welcome to iShortn!</Text>
        <Text style={paragraph}>
          The best place to start is your first short link. Paste a long URL and you get a short
          link you can share and track in under a minute.
        </Text>
        <Section style={btnContainer}>
          <Button style={button} href={CREATE_LINK_URL}>
            Shorten your first link
          </Button>
        </Section>
        <Text style={paragraph}>Then try:</Text>
        <ul style={list}>
          {nextSteps.map((step) => (
            <li key={step.href} style={listItem}>
              <Link href={step.href} style={link}>
                {step.label}
              </Link>
            </li>
          ))}
        </ul>
        <Text style={paragraph}>
          If you have a question or a feature request, feel free to reach out to me at{" "}
          <Link href="mailto:kelvin@ishortn.ink" style={link}>
            kelvin@ishortn.ink
          </Link>
        </Text>
        <Text style={paragraph}>
          Best,
          <br />
          Kelvin Amoaba
          <br />
          iShortn Developer
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          In case you need an engineer on your team or a freelancer, I am available for hire. You
          can check out my portfolio at{" "}
          <Link href="https://kelvinamoaba.com" style={link}>
            kelvinamoaba.com
          </Link>
        </Text>
      </Container>
    </Body>
  </Html>
);

export const renderWelcomeEmail = (name: string) => {
  return render(<WelcomeEmail userFirstname={name} />);
};

WelcomeEmail.PreviewProps = {
  userFirstname: "Kelvin",
} satisfies WelcomeEmailProps;

export default WelcomeEmail;

const main = {
  backgroundColor: "#ffffff",
  color: "#000000",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: "0 auto",
  maxWidth: "560px",
  padding: "32px 20px 48px",
};

const paragraph = {
  color: "#000000",
  fontSize: "16px",
  lineHeight: "26px",
};

const link = {
  color: "#000000",
  textDecoration: "underline",
};

const list = {
  margin: "0 0 16px",
  paddingLeft: "20px",
};

const listItem = {
  color: "#000000",
  fontSize: "16px",
  lineHeight: "26px",
  marginBottom: "4px",
};

const btnContainer = {
  textAlign: "center" as const,
};

const button = {
  backgroundColor: "#2563eb",
  borderRadius: "4px",
  color: "#fff",
  fontSize: "16px",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 18px",
};

const hr = {
  borderColor: "#e5e5e5",
  margin: "20px 0",
};

const footer = {
  color: "#000000",
  fontSize: "12px",
  lineHeight: "20px",
};
