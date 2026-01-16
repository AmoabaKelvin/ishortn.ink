import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import type { ResourceCounts } from "@/server/api/routers/account-transfer/account-transfer.service";

type AccountTransferEmailProps = {
  recipientName?: string | null;
  senderName: string;
  senderEmail: string;
  acceptUrl: string;
  resourceCounts: ResourceCounts;
};

export const AccountTransferEmail = ({
  recipientName,
  senderName,
  senderEmail,
  acceptUrl,
  resourceCounts,
}: AccountTransferEmailProps) => {
  const totalResources =
    resourceCounts.links +
    resourceCounts.customDomains +
    resourceCounts.qrCodes +
    resourceCounts.folders +
    resourceCounts.tags +
    resourceCounts.utmTemplates +
    resourceCounts.qrPresets;

  return (
    <Html>
      <Head />
      <Preview>
        {senderName} wants to transfer their iShortn account to you
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Text style={text}>Hi {recipientName || "there"},</Text>

            <Text style={text}>
              <strong>{senderName}</strong> ({senderEmail}) has requested to
              transfer their iShortn account and all resources to you.
            </Text>

            <Hr style={hr} />

            <Text style={headingText}>Resources to be transferred:</Text>

            <Section style={resourceList}>
              {resourceCounts.links > 0 && (
                <Text style={resourceItem}>
                  {resourceCounts.links} link{resourceCounts.links !== 1 ? "s" : ""}
                </Text>
              )}
              {resourceCounts.customDomains > 0 && (
                <Text style={resourceItem}>
                  {resourceCounts.customDomains} custom domain
                  {resourceCounts.customDomains !== 1 ? "s" : ""}
                </Text>
              )}
              {resourceCounts.qrCodes > 0 && (
                <Text style={resourceItem}>
                  {resourceCounts.qrCodes} QR code
                  {resourceCounts.qrCodes !== 1 ? "s" : ""}
                </Text>
              )}
              {resourceCounts.folders > 0 && (
                <Text style={resourceItem}>
                  {resourceCounts.folders} folder
                  {resourceCounts.folders !== 1 ? "s" : ""}
                </Text>
              )}
              {resourceCounts.tags > 0 && (
                <Text style={resourceItem}>
                  {resourceCounts.tags} tag{resourceCounts.tags !== 1 ? "s" : ""}
                </Text>
              )}
              {resourceCounts.utmTemplates > 0 && (
                <Text style={resourceItem}>
                  {resourceCounts.utmTemplates} UTM template
                  {resourceCounts.utmTemplates !== 1 ? "s" : ""}
                </Text>
              )}
              {resourceCounts.qrPresets > 0 && (
                <Text style={resourceItem}>
                  {resourceCounts.qrPresets} QR preset
                  {resourceCounts.qrPresets !== 1 ? "s" : ""}
                </Text>
              )}
              {totalResources === 0 && (
                <Text style={resourceItem}>No resources to transfer</Text>
              )}
            </Section>

            <Hr style={hr} />

            <Text style={headingText}>Important notes:</Text>
            <Text style={smallText}>
              - All analytics data will be preserved automatically
            </Text>
            <Text style={smallText}>
              - Folders and tags will be merged by name if they already exist
            </Text>
            <Text style={smallText}>
              - API tokens and subscriptions will NOT be transferred
            </Text>
            <Text style={smallText}>
              - The sender&apos;s account will be marked for deletion after transfer
              (30-day grace period)
            </Text>

            <Section style={buttonContainer}>
              <Button style={button} href={acceptUrl}>
                Review & Accept Transfer
              </Button>
            </Section>

            <Text style={smallText}>
              Or copy and paste this URL into your browser:{" "}
              <span style={linkText}>{acceptUrl}</span>
            </Text>

            <Text style={smallText}>
              This invitation will expire in 7 days. If you don&apos;t want to accept
              this transfer, you can safely ignore this email.
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

const headingText = {
  color: "#333",
  fontSize: "16px",
  fontWeight: 600,
  lineHeight: "24px",
  marginTop: "16px",
  marginBottom: "8px",
};

const smallText = {
  color: "#666",
  fontSize: "14px",
  lineHeight: "20px",
  marginTop: "4px",
  marginBottom: "4px",
};

const linkText = {
  color: "#2563eb",
  wordBreak: "break-all" as const,
};

const resourceList = {
  backgroundColor: "#f9fafb",
  borderRadius: "8px",
  padding: "16px",
  marginTop: "8px",
  marginBottom: "8px",
};

const resourceItem = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "20px",
  margin: "4px 0",
};

const hr = {
  borderColor: "#e5e7eb",
  marginTop: "24px",
  marginBottom: "24px",
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

export default AccountTransferEmail;
