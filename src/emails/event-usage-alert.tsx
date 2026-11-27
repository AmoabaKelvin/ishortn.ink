import { Text } from "@react-email/components";

import { PLAN_CAPS, type Plan } from "@/lib/billing/plans";
import { promoOfferLine, type Promo } from "@/lib/billing/promo";
import { EMAIL_LINKS, emailLinkUrl } from "@/lib/email/links";

import { EmailButton, EmailLayout, text } from "./_components/layout";

type EventUsageAlertEmailProps = {
  threshold: number;
  limit: number;
  currentCount: number;
  plan: Plan;
  resetDate: string;
  /** The month's count reaches the limit before the reset at its current pace. */
  onPaceToReachLimit: boolean;
  /** The next plan up; its tracked-click allowance is read from PLAN_CAPS. */
  upgrade: { plan: Exclude<Plan, "free">; label: string; url: string };
  /** Running offer, only passed when the upgrade would be a new checkout. */
  promo?: Promo | null;
  notificationSettingsUrl: string;
};

const PLAN_NAMES = { free: "Free", pro: "Pro", ultra: "Ultra" } satisfies Record<Plan, string>;

export function eventUsageSubject({
  threshold,
  resetDate,
}: Pick<EventUsageAlertEmailProps, "threshold" | "resetDate">): string {
  return threshold >= 100
    ? `Click tracking is paused until ${resetDate}`
    : `You've used ${threshold}% of this month's tracked clicks`;
}

function preview(props: EventUsageAlertEmailProps): string {
  const { threshold, limit, currentCount, resetDate, onPaceToReachLimit } = props;
  if (threshold >= 100) {
    return `Your links still work. Clicks from now until ${resetDate} won't show in your analytics.`;
  }
  const usage = `${currentCount.toLocaleString()} of ${limit.toLocaleString()}.`;
  return onPaceToReachLimit
    ? `${usage} At this pace you'll reach the limit before ${resetDate}.`
    : `${usage} Your count resets on ${resetDate}.`;
}

export const EventUsageAlertEmail = (props: EventUsageAlertEmailProps) => {
  const { threshold, limit, currentCount, plan, resetDate, upgrade, promo } = props;
  const capReached = threshold >= 100;
  const upgradeName = PLAN_NAMES[upgrade.plan];
  const upgradeLimit = PLAN_CAPS[upgrade.plan].eventsLimit;
  const upgradeOffer =
    upgradeLimit === undefined
      ? `${upgradeName} has no monthly limit on tracked clicks`
      : `${upgradeName} includes ${upgradeLimit.toLocaleString()} tracked clicks a month`;

  return (
    <EmailLayout
      preview={preview(props)}
      headline={eventUsageSubject(props)}
      notificationSettingsUrl={props.notificationSettingsUrl}
    >
      {capReached ? (
        <Text style={text}>
          Your links have used all {limit.toLocaleString()} tracked clicks in the {PLAN_NAMES[plan]}{" "}
          plan this month. They keep redirecting as normal, but new clicks won&apos;t show in your
          analytics until {resetDate}.
        </Text>
      ) : (
        <Text style={text}>
          Your links have used {currentCount.toLocaleString()} of the {limit.toLocaleString()}{" "}
          tracked clicks in the {PLAN_NAMES[plan]} plan this month. If they reach the limit, they
          keep redirecting, but new clicks won&apos;t show in your analytics until {resetDate}.
        </Text>
      )}

      <Text style={text}>
        {capReached
          ? `${upgradeOffer}, and upgrading resumes tracking straight away.`
          : `${upgradeOffer}.`}
        {promo && ` ${promoOfferLine(promo, upgradeName)}`}
      </Text>

      <EmailButton href={upgrade.url}>
        {capReached ? "Track every click" : upgrade.label}
      </EmailButton>
    </EmailLayout>
  );
};

EventUsageAlertEmail.PreviewProps = {
  threshold: 100,
  limit: 1000,
  currentCount: 1000,
  plan: "free",
  resetDate: "December 1",
  onPaceToReachLimit: true,
  upgrade: {
    plan: "pro",
    label: "Upgrade to Pro",
    url: emailLinkUrl(EMAIL_LINKS.eventUsage.pro[100]),
  },
  notificationSettingsUrl: "https://ishortn.ink/dashboard/settings#notifications",
} satisfies EventUsageAlertEmailProps;

export default EventUsageAlertEmail;
