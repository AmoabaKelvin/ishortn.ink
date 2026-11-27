import { Text } from "@react-email/components";

import { PLAN_CAPS, type Plan } from "@/lib/billing/plans";
import { promoOfferLine, type Promo } from "@/lib/billing/promo";
import { EMAIL_LINKS, emailLinkUrl } from "@/lib/email/links";
import { displayName } from "@/lib/utils/user-name";

import { EmailButton, EmailLayout, Signoff, text } from "./_components/layout";

type EventUsageAlertEmailProps = {
  userName?: string | null;
  threshold: number;
  limit: number;
  currentCount: number;
  plan: Plan;
  resetDate: string;
  /** The next plan up; its event allowance is read from PLAN_CAPS. */
  upgrade: { plan: Exclude<Plan, "free">; label: string; url: string };
  /** Running offer, only passed when the upgrade would be a new checkout. */
  promo?: Promo | null;
  notificationSettingsUrl: string;
};

const PLAN_NAMES = { free: "Free", pro: "Pro", ultra: "Ultra" } satisfies Record<Plan, string>;

export const EventUsageAlertEmail = ({
  userName,
  threshold,
  limit,
  currentCount,
  plan,
  resetDate,
  upgrade,
  promo,
  notificationSettingsUrl,
}: EventUsageAlertEmailProps) => {
  const capReached = threshold >= 100;
  const planName = PLAN_NAMES[plan];
  const upgradeLimit = PLAN_CAPS[upgrade.plan].eventsLimit;
  const upgradeOffer =
    upgradeLimit === undefined
      ? `The ${PLAN_NAMES[upgrade.plan]} plan has no monthly event cap.`
      : `The ${PLAN_NAMES[upgrade.plan]} plan includes ${upgradeLimit.toLocaleString()} analytics events a month.`;

  return (
    <EmailLayout
      preview={
        capReached
          ? "Analytics recording is paused until your monthly cap resets"
          : `You've used ${threshold}% of your monthly analytics events`
      }
      notificationSettingsUrl={notificationSettingsUrl}
    >
      <Text style={text}>Hi {displayName(userName) ?? "there"},</Text>

      {capReached ? (
        <>
          <Text style={text}>
            You&apos;ve used all {limit.toLocaleString()} analytics events included in the{" "}
            {planName} plan this month. Your links keep redirecting as normal, but new visits
            aren&apos;t recorded until your cap resets on {resetDate}.
          </Text>
          <Text style={text}>{upgradeOffer} Upgrading resumes recording straight away.</Text>
        </>
      ) : (
        <>
          <Text style={text}>
            Heads up: you&apos;ve used {currentCount.toLocaleString()} of the{" "}
            {limit.toLocaleString()} analytics events included in the {planName} plan this month (
            {threshold}%).
          </Text>
          <Text style={text}>
            Your links keep redirecting either way, but once you reach the cap new visits
            aren&apos;t recorded until it resets on {resetDate}. {upgradeOffer}
          </Text>
        </>
      )}

      {promo && (
        <Text style={text}>
          {promoOfferLine(promo, PLAN_NAMES[upgrade.plan])} Upgrading resumes tracking straight
          away.
        </Text>
      )}

      <EmailButton href={upgrade.url}>{upgrade.label}</EmailButton>

      <Text style={text}>
        If this doesn&apos;t look right, reply to this email and we&apos;ll help out.
      </Text>

      <Signoff />
    </EmailLayout>
  );
};

EventUsageAlertEmail.PreviewProps = {
  userName: "Ama",
  threshold: 100,
  limit: 1000,
  currentCount: 1000,
  plan: "free",
  resetDate: "December 1",
  upgrade: {
    plan: "pro",
    label: "Upgrade to Pro",
    url: emailLinkUrl(EMAIL_LINKS.eventUsage.pro[100]),
  },
  notificationSettingsUrl: "https://ishortn.ink/dashboard/settings#notifications",
} satisfies EventUsageAlertEmailProps;

export default EventUsageAlertEmail;
