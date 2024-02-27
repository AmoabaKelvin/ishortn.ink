import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Link,
} from "@react-email/components";
import { render } from "@react-email/render";
import * as React from "react";

interface WelcomeEmailProps {
  userFirstname: string;
}

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000/";

export const WelcomeEmail = ({ userFirstname }: WelcomeEmailProps) => (
  <Html>
    <Head />
    <Preview>iShortn - Free and open-source URL shortener</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src={`${baseUrl}/images/logo-text-white.png`}
          width="170"
          height="70"
          alt="iShortn"
          style={logo}
        />
        <Text style={paragraph}>Hi {userFirstname},</Text>
        <Text style={paragraph}>Welcome and signing up to iShortn!</Text>
        <Text style={paragraph}>
          It&apos;s great to have you onboard our fleet of users. Just incase
          you have a concern or a feature request you will want to share with
          us, feel free to reach out to me at{" "}
          <Link href="mailto:kelvin@ishortn.ink">kelvin@ishortn.ink</Link>
        </Text>
        <Section style={btnContainer}>
          <Button style={button} href="https://ishortn.ink/dashboard">
            Visit your Dashboard
          </Button>
        </Section>
        <Text style={paragraph}>
          Best,
          <br />
          Kelvin Amoaba
          <br />
          iShortn Developer
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          Incase you need an engineer on your team or a freelancer, I am
          available for hire. You can check out my portfolio at{" "}
          <Link href="https://kelvinamoaba.lice">kelvinamoaba.live</Link>
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
} as WelcomeEmailProps;

export default WelcomeEmail;

const main = {
  backgroundColor: "#111827",
  color: "#f0f0f0",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "20px 0 48px",
};

const logo = {
  margin: "0 auto",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "26px",
};

const btnContainer = {
  textAlign: "center" as const,
};

const button = {
  backgroundColor: "#5F51E8",
  borderRadius: "3px",
  color: "#fff",
  fontSize: "16px",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  padding: "12px",
};

const hr = {
  borderColor: "#cccccc",
  margin: "20px 0",
};

const footer = {
  color: "#8898aa",
  fontSize: "12px",
};
