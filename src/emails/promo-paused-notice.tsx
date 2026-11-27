import { Text } from "@react-email/components";

import { PLAN_NAMES } from "@/lib/billing/entitlements";
import { PLAN_CAPS } from "@/lib/billing/plans";
import { ACTIVE_PROMO, promoOfferLine, type Promo } from "@/lib/billing/promo";
import { EMAIL_LINKS, emailLinkUrl } from "@/lib/email/links";

import { EmailButton, EmailLayout, text } from "./_components/layout";

type PromoPausedNoticeEmailProps = {
  dropped: number;
  pausedOn: string;
  resumesOn: string;
  promo: Promo;
  upgrade: { plan: "pro" | "ultra"; label: string; url: string };
  notificationSettingsUrl: string;
};

const formatClicks = (count: number) =>
  `${count.toLocaleString()} ${count === 1 ? "click" : "clicks"}`;

export function promoPausedNoticeSubject({
  dropped,
  pausedOn,
}: Pick<PromoPausedNoticeEmailProps, "dropped" | "pausedOn">): string {
  return `${formatClicks(dropped)} ${dropped === 1 ? "hasn't" : "haven't"} been tracked since ${pausedOn}`;
}

export const PromoPausedNoticeEmail = ({
  dropped,
  pausedOn,
  resumesOn,
  promo,
  upgrade,
  notificationSettingsUrl,
}: PromoPausedNoticeEmailProps) => {
  const planName = PLAN_NAMES[upgrade.plan];
  const freeLimit = PLAN_CAPS.free.eventsLimit;
  const upgradeLimit = PLAN_CAPS[upgrade.plan].eventsLimit;

  return (
    <EmailLayout
      preview={`Your links still work. Tracking resumes on its own on ${resumesOn}.`}
      headline={`Click tracking is paused until ${resumesOn}`}
      notificationSettingsUrl={notificationSettingsUrl}
    >
      <Text style={text}>
        Your links reached the Free plan&apos;s {freeLimit?.toLocaleString()} tracked clicks for
        this month on {pausedOn}. Since then, {formatClicks(dropped)} reached your links without
        showing in your analytics. Your links keep redirecting as normal.
      </Text>

      <Text style={text}>
        {upgradeLimit === undefined
          ? `${planName} has no monthly limit on tracked clicks`
          : `${planName} includes ${upgradeLimit.toLocaleString()} tracked clicks a month`}{" "}
        and resumes tracking as soon as you upgrade. {promoOfferLine(promo, planName)}
      </Text>

      <EmailButton href={upgrade.url}>{upgrade.label}</EmailButton>

      <Text style={text}>If the Free plan suits you, there&apos;s nothing to do.</Text>
    </EmailLayout>
  );
};

PromoPausedNoticeEmail.PreviewProps = {
  dropped: 1_284,
  pausedOn: "November 20",
  resumesOn: "December 1",
  promo: ACTIVE_PROMO,
  upgrade: {
    plan: "pro",
    label: "Upgrade to Pro",
    url: emailLinkUrl(EMAIL_LINKS.promoPaused.pro),
  },
  notificationSettingsUrl: "https://ishortn.ink/dashboard/settings#notifications",
} satisfies PromoPausedNoticeEmailProps;

export default PromoPausedNoticeEmail;
