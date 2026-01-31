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

import type { ResourceCounts } from "@/server/api/routers/account-transfer/account-transfer.service";

type TransferCompletedEmailProps = {
  senderName?: string | null;
  recipientName: string;
  recipientEmail: string;
  resourceCounts: ResourceCounts;
};

export const TransferCompletedEmail = ({
  senderName,
  recipientName,
  recipientEmail,
  resourceCounts,
}: TransferCompletedEmailProps) => {
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
      <Preview>Your iShortn resources have been transferred</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Text style={text}>Hi {senderName || "there"},</Text>

            <Text style={text}>
              Your resource transfer to <strong>{recipientName}</strong> (
              {recipientEmail}) has been completed successfully.
            </Text>

            <Hr style={hr} />

            <Text style={headingText}>Resources transferred:</Text>

            <Section style={resourceList}>
              {resourceCounts.links > 0 && (
                <Text style={resourceItem}>
                  {resourceCounts.links} link
                  {resourceCounts.links !== 1 ? "s" : ""}
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
                <Text style={resourceItem}>No resources transferred</Text>
              )}
            </Section>

            <Hr style={hr} />

            <Text style={text}>
              These resources are now owned by {recipientName} and have been
              removed from your account.
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

const resourceList = {
  backgroundColor: "#f0fdf4",
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

export default TransferCompletedEmail;
