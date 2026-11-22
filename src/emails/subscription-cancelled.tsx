import { Text } from "@react-email/components";

import { displayName } from "@/lib/utils/user-name";

import { EmailButton, EmailLayout, Signoff, text } from "./_components/layout";

type SubscriptionCancelledEmailProps = {
  userName?: string | null;
  planName: string;
  /** Null when the provider sent no end date; the copy then omits it. */
  accessUntil: string | null;
  billingUrl: string;
};

export const SubscriptionCancelledEmail = ({
  userName,
  planName,
  accessUntil,
  billingUrl,
}: SubscriptionCancelledEmailProps) => {
  return (
    <EmailLayout preview={`Your iShortn ${planName} subscription has been cancelled`}>
      <Text style={text}>Hi {displayName(userName) ?? "there"},</Text>

      <Text style={text}>
        Your iShortn {planName} subscription has been cancelled and won&apos;t renew.{" "}
        {accessUntil ? (
          <>
            You keep every {planName} feature until <strong>{accessUntil}</strong>.
          </>
        ) : (
          <>You keep every {planName} feature until the end of your current billing period.</>
        )}
      </Text>

      <Text style={text}>
        After that your account moves to the Free plan and its limits apply. You can subscribe again
        at any time from your billing settings.
      </Text>

      <EmailButton href={billingUrl}>Open billing settings</EmailButton>

      <Text style={text}>
        If something made you leave, reply to this email. We read every reply.
      </Text>

      <Signoff />
    </EmailLayout>
  );
};

SubscriptionCancelledEmail.PreviewProps = {
  userName: "Ama",
  planName: "Pro",
  accessUntil: "December 20, 2026",
  billingUrl: "https://ishortn.ink/dashboard/settings#billing",
} satisfies SubscriptionCancelledEmailProps;

export default SubscriptionCancelledEmail;
