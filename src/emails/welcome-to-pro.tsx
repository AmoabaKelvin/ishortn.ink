import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text
} from "@react-email/components";

interface WelcomeEmailProps {
  userName?: string;
  supportEmail?: string;
  senderName?: string;
}

export const WelcomeEmail = ({
  userName,
  supportEmail = "support@ishortn.ink",
  senderName = "Kelvin",
}: WelcomeEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Welcome to iShortn PRO!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Text style={text}>Hi {userName},</Text>

            <Text style={text}>
              Thank you for choosing iShortn PRO! We're thrilled to have you as
              a valued member and are honored by the trust you've placed in us.
            </Text>

            <Text style={text}>
              With PRO, you now have access to advanced features designed to
              help you get even more from every link you share. Our goal is to
              ensure that your experience with iShortn is as seamless and
              impactful as possible.
            </Text>

            <Text style={text}>
              If you have any questions or need assistance at any point, please
              don't hesitate to reach out. You can reply to this email or
              contact us anytime at {supportEmail}. We're here to help and are
              committed to providing the best possible experience for you.
            </Text>

            <Text style={text}>Thank you once again, and welcome aboard!</Text>

            <Text style={text}>Warm regards,</Text>
            <Text style={text}>{senderName}</Text>
            <Text style={{ ...text, fontWeight: 500 }}>iShortn Team</Text>
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

export default WelcomeEmail;
