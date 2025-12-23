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

type Challenge = {
  type: "TXT" | "A" | "CNAME";
  domain: string;
  value: string;
};

type DomainReminderEmailProps = {
  recipientName?: string | null;
  domain: string;
  daysMisconfigured: number;
  challenges: Challenge[];
  dashboardUrl: string;
};

export const DomainReminderEmail = ({
  recipientName,
  domain,
  daysMisconfigured,
  challenges,
  dashboardUrl,
}: DomainReminderEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>{domain} needs configuration on iShortn</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Text style={text}>Hi {recipientName || "there"},</Text>

            <Text style={text}>
              Your custom domain <strong>{domain}</strong> has been pending configuration for{" "}
              <strong>
                {daysMisconfigured} {daysMisconfigured === 1 ? "day" : "days"}
              </strong>
              . Until the DNS is configured correctly, links using this domain won&apos;t work.
            </Text>

            <Text style={text}>
              To get your domain working, add the following DNS records at your domain provider:
            </Text>

            <Section style={tableContainer}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={tableHeader}>Type</th>
                    <th style={tableHeader}>Name</th>
                    <th style={tableHeader}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {challenges.map((challenge) => (
                    <tr key={`${challenge.type}-${challenge.domain}`}>
                      <td style={tableCell}>{challenge.type}</td>
                      <td style={tableCell}>
                        <code style={codeStyle}>{challenge.domain}</code>
                      </td>
                      <td style={tableCellValue}>
                        <code style={codeStyle}>{challenge.value}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Text style={smallText}>
              DNS changes can take up to 48 hours to propagate. After adding these records, visit
              your dashboard to verify the configuration.
            </Text>

            <Section style={buttonContainer}>
              <Button style={button} href={dashboardUrl}>
                View Domain Settings
              </Button>
            </Section>

            <Text style={smallText}>
              Or copy and paste this URL into your browser:{" "}
              <span style={linkText}>{dashboardUrl}</span>
            </Text>

            <Text style={text}>
              If you need help configuring your DNS, reply to this email and we&apos;ll assist you.
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

const tableContainer = {
  marginTop: "16px",
  marginBottom: "16px",
};

const table = {
  width: "100%",
  borderCollapse: "collapse" as const,
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
};

const tableHeader = {
  backgroundColor: "#f9fafb",
  padding: "10px 12px",
  textAlign: "left" as const,
  fontSize: "12px",
  fontWeight: 600,
  color: "#6b7280",
  borderBottom: "1px solid #e5e7eb",
};

const tableCell = {
  padding: "10px 12px",
  fontSize: "14px",
  color: "#333",
  borderBottom: "1px solid #e5e7eb",
};

const tableCellValue = {
  ...tableCell,
  maxWidth: "200px",
  wordBreak: "break-all" as const,
};

const codeStyle = {
  backgroundColor: "#f3f4f6",
  padding: "2px 6px",
  borderRadius: "4px",
  fontSize: "13px",
  fontFamily: "monospace",
};

export default DomainReminderEmail;
