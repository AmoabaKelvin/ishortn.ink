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

type MigrationDomain = {
  domain: string;
  isApex: boolean;
};

type DomainMigrationEmailProps = {
  recipientName?: string | null;
  domains: MigrationDomain[];
  cnameTarget: string;
  deadlineText: string;
  dashboardUrl: string;
  isReminder?: boolean;
};

export const DomainMigrationEmail = ({
  recipientName,
  domains,
  cnameTarget,
  deadlineText,
  dashboardUrl,
  isReminder,
}: DomainMigrationEmailProps) => {
  const hasApex = domains.some((d) => d.isApex);
  const subdomainExample = domains.find((d) => !d.isApex)?.domain;
  const plural = domains.length > 1;

  return (
    <Html>
      <Head />
      <Preview>One DNS change keeps your custom domains working on iShortn</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Text style={text}>Hi {recipientName || "there"},</Text>

            {isReminder && (
              <Text style={text}>
                We wrote earlier about moving iShortn to a new network. The{" "}
                {plural ? "records below have" : "record below has"} not changed yet, and the move
                happens {deadlineText} — here are the details again.
              </Text>
            )}

            <Text style={text}>
              We are moving iShortn to a faster, more reliable network. To bring your custom{" "}
              {plural ? "domains" : "domain"} along, update one DNS record per domain at your
              provider: point it at <code style={codeStyle}>{cnameTarget}</code>.
            </Text>

            <Section style={tableContainer}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={tableHeader}>Host / Subdomain</th>
                    <th style={tableHeader}>Type</th>
                    <th style={tableHeader}>Value / Points to</th>
                  </tr>
                </thead>
                <tbody>
                  {domains.map((entry) => (
                    <tr key={entry.domain}>
                      <td style={tableCell}>
                        <code style={codeStyle}>{entry.domain}</code>
                      </td>
                      <td style={tableCell}>CNAME</td>
                      <td style={tableCellValue}>
                        <code style={codeStyle}>{cnameTarget}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Text style={smallText}>
              Your domain already has a record pointing at our old network — edit that record and
              change its value to <code style={codeStyle}>{cnameTarget}</code>.
            </Text>

            {subdomainExample && (
              <Text style={smallText}>
                Note: depending on your DNS provider, you may only need to enter the subdomain
                prefix in the Host/Name field — for example, enter{" "}
                <code style={codeStyle}>{subdomainExample.split(".")[0]}</code> instead of{" "}
                <code style={codeStyle}>{subdomainExample}</code>.
              </Text>
            )}

            {hasApex && (
              <Text style={smallText}>
                For a root domain, your DNS provider must support ALIAS, ANAME, or flattened CNAME
                records (Cloudflare, Namecheap, Porkbun, and Route 53 all do). Create the record
                above as an ALIAS or ANAME pointing to the same value.
              </Text>
            )}

            <Section style={warningBox}>
              <Text style={warningText}>
                Your links keep working as normal until we complete the move {deadlineText}. After
                that, short links, QR codes, and bio pages on the {plural ? "domains" : "domain"}{" "}
                above will stop working until the records are updated.
              </Text>
            </Section>

            <Section style={buttonContainer}>
              <Button style={button} href={dashboardUrl}>
                Verify in your dashboard
              </Button>
            </Section>

            <Text style={smallText}>
              After you make the change, open your dashboard and use &quot;Verify
              configuration&quot; to confirm it worked. DNS changes can take up to 48 hours to
              propagate.
            </Text>

            <Text style={text}>
              If you need help, reply to this email and we&apos;ll walk you through it.
            </Text>

            <Text style={text}>Thanks for using iShortn!</Text>
            <Text style={{ ...text, fontWeight: 500 }}>Kelvin &amp; the iShortn team</Text>
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

const warningBox = {
  backgroundColor: "#fffbeb",
  border: "1px solid #fde68a",
  borderRadius: "8px",
  padding: "4px 16px",
  marginTop: "16px",
};

const warningText = {
  color: "#b45309",
  fontSize: "14px",
  lineHeight: "20px",
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

export default DomainMigrationEmail;
