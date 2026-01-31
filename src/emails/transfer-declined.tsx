import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type TransferDeclinedEmailProps = {
  senderName?: string | null;
  recipientName: string;
  recipientEmail: string;
};

export const TransferDeclinedEmail = ({
  senderName,
  recipientName,
  recipientEmail,
}: TransferDeclinedEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Your iShortn transfer request was declined</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Text style={text}>Hi {senderName || "there"},</Text>

            <Text style={text}>
              Your resource transfer request to <strong>{recipientName}</strong>{" "}
              ({recipientEmail}) has been declined.
            </Text>

            <Hr style={hr} />

            <Text style={text}>
              Your resources remain in your account and have not been
              transferred. If you&apos;d like to transfer your resources to a
              different account, you can initiate a new transfer from your
              settings.
            </Text>

            <Hr style={hr} />

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

const hr = {
  borderColor: "#e5e7eb",
  marginTop: "24px",
  marginBottom: "24px",
};

export default TransferDeclinedEmail;
