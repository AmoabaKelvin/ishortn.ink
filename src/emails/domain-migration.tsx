import { Section, Text } from "@react-email/components";

import { displayName } from "@/lib/utils/user-name";

import {
  CodeBlock,
  EmailButton,
  EmailLayout,
  fieldLabel,
  monoFontFamily,
  recordTitle,
  Signoff,
  smallText,
  text,
  Well,
} from "./_components/layout";

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
    <EmailLayout preview="One DNS change keeps your custom domains working on iShortn">
      <Text style={text}>Hi {displayName(recipientName) ?? "there"},</Text>

      {isReminder && (
        <Text style={text}>
          We wrote earlier about moving iShortn to a new network. The{" "}
          {plural ? "records below have" : "record below has"} not changed yet, and the move happens{" "}
          {deadlineText} — here are the details again.
        </Text>
      )}

      <Text style={text}>
        We are moving iShortn to a faster, more reliable network. To bring your custom{" "}
        {plural ? "domains" : "domain"} along, update one DNS record per domain at your provider:
        point it at <code style={inlineCode}>{cnameTarget}</code>.
      </Text>

      {domains.map((entry) => (
        <Well key={entry.domain}>
          <Text style={recordTitle}>CNAME record</Text>
          <Text style={fieldLabel}>Host / Subdomain</Text>
          <CodeBlock>{entry.domain}</CodeBlock>
          <Text style={fieldLabel}>Value / Points to</Text>
          <CodeBlock>{cnameTarget}</CodeBlock>
        </Well>
      ))}

      <Text style={smallText}>
        Your domain already has a record pointing at our old network — edit that record and change
        its value to <code style={inlineCode}>{cnameTarget}</code>.
      </Text>

      {subdomainExample && (
        <Text style={smallText}>
          Note: depending on your DNS provider, you may only need to enter the subdomain prefix in
          the Host/Name field — for example, enter{" "}
          <code style={inlineCode}>{subdomainExample.split(".")[0]}</code> instead of{" "}
          <code style={inlineCode}>{subdomainExample}</code>.
        </Text>
      )}

      {hasApex && (
        <Text style={smallText}>
          For a root domain, your DNS provider must support ALIAS, ANAME, or flattened CNAME records
          (Cloudflare, Namecheap, Porkbun, and Route 53 all do). Create the record above as an ALIAS
          or ANAME pointing to the same value.
        </Text>
      )}

      <Section className="email-warning" style={warningBox}>
        <Text style={warningText}>
          Your links keep working as normal until we complete the move {deadlineText}. After that,
          short links, QR codes, and bio pages on the {plural ? "domains" : "domain"} above will
          stop working until the records are updated.
        </Text>
      </Section>

      <EmailButton href={dashboardUrl}>Verify in your dashboard</EmailButton>

      <Text style={smallText}>
        After you make the change, open your dashboard and use &quot;Verify configuration&quot; to
        confirm it worked. DNS changes can take up to 48 hours to propagate.
      </Text>

      <Text style={text}>
        If you need help, reply to this email and we&apos;ll walk you through it.
      </Text>

      <Signoff />
    </EmailLayout>
  );
};

const inlineCode = {
  backgroundColor: "#f5f5f5",
  borderRadius: "4px",
  fontFamily: monoFontFamily,
  fontSize: "13px",
  padding: "1px 4px",
  wordBreak: "break-all" as const,
};

const warningBox = {
  backgroundColor: "#fffbeb",
  border: "1px solid #fde68a",
  borderRadius: "10px",
  padding: "4px 16px",
  margin: "0 0 16px",
};

const warningText = {
  color: "#b45309",
  fontSize: "14px",
  lineHeight: "20px",
};

DomainMigrationEmail.PreviewProps = {
  recipientName: "Ama",
  domains: [
    { domain: "go.acmestudio.com", isApex: false },
    { domain: "acme.link", isApex: true },
  ],
  cnameTarget: "cname.ishortn.ink",
  deadlineText: "on December 1, 2026",
  dashboardUrl: "https://ishortn.ink/dashboard/domains",
} satisfies DomainMigrationEmailProps;

export default DomainMigrationEmail;
