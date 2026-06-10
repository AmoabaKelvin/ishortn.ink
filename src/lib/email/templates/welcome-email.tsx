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

export const WelcomeEmail = ({ userFirstname }: WelcomeEmailProps) => (
  <Html>
    <Head />
    <Preview>iShortn - Free and open-source URL shortener</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={paragraph}>Hi {userFirstname ? userFirstname : "there"},</Text>
        <Text style={paragraph}>Welcome and signing up to iShortn!</Text>
        <Text style={paragraph}>
          It&apos;s great to have you onboard our fleet of users. Just incase you have a concern or
          a feature request you will want to share with us, feel free to reach out to me at{" "}
          <Link href="mailto:kelvin@ishortn.ink" style={link}>
            kelvin@ishortn.ink
          </Link>
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
          Incase you need an engineer on your team or a freelancer, I am available for hire. You can
          check out my portfolio at{" "}
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
} as WelcomeEmailProps;

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
