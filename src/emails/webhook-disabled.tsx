import { Text } from "@react-email/components";

import { displayName } from "@/lib/utils/user-name";

import { CodeBlock, EmailButton, EmailLayout, Signoff, text } from "./_components/layout";

type WebhookDisabledEmailProps = {
  userName?: string | null;
  endpointUrl: string;
  failures: number;
  lastError: string | null;
  /** Team name for a team workspace's endpoint; null for a personal one. */
  teamName: string | null;
  settingsUrl: string;
};

export const WebhookDisabledEmail = ({
  userName,
  endpointUrl,
  failures,
  lastError,
  teamName,
  settingsUrl,
}: WebhookDisabledEmailProps) => {
  return (
    <EmailLayout preview="We paused a webhook endpoint that kept failing">
      <Text style={text}>Hi {displayName(userName) ?? "there"},</Text>

      <Text style={text}>
        We stopped sending events to this webhook endpoint
        {teamName ? (
          <>
            {" "}
            in <strong>{teamName}</strong>
          </>
        ) : null}{" "}
        after {failures} delivery attempts in a row failed:
      </Text>

      <CodeBlock>{endpointUrl}</CodeBlock>

      {lastError ? (
        <Text style={text}>
          The last attempt failed with: <strong>{lastError}</strong>
        </Text>
      ) : null}

      <Text style={text}>
        Once the endpoint accepts requests again, turn it back on in your settings and use Send test
        event to check it. Events from while it was off aren&apos;t resent.
      </Text>

      <EmailButton href={settingsUrl}>Open webhook settings</EmailButton>

      <Signoff />
    </EmailLayout>
  );
};

WebhookDisabledEmail.PreviewProps = {
  userName: "Ama",
  endpointUrl: "https://hooks.example.com/ishortn",
  failures: 20,
  lastError: "HTTP 503",
  teamName: null,
  settingsUrl: "https://ishortn.ink/dashboard/settings#webhooks",
} satisfies WebhookDisabledEmailProps;

export default WebhookDisabledEmail;
