import { Text } from "@react-email/components";

import { PLAN_NAMES } from "@/lib/billing/entitlements";
import { PLAN_CAPS } from "@/lib/billing/plans";
import { ACTIVE_PROMO, promoOfferLine, type Promo } from "@/lib/billing/promo";
import { EMAIL_LINKS, emailLinkUrl } from "@/lib/email/links";
import { displayName } from "@/lib/utils/user-name";

import { EmailButton, EmailLayout, Signoff, text } from "./_components/layout";

type PromoPausedNoticeEmailProps = {
  userName?: string | null;
  dropped: number;
  pausedOn: string;
  resumesOn: string;
  promo: Promo;
  upgrade: { plan: "pro" | "ultra"; label: string; url: string };
  notificationSettingsUrl: string;
};

export const PromoPausedNoticeEmail = ({
  userName,
  dropped,
  pausedOn,
  resumesOn,
  promo,
  upgrade,
  notificationSettingsUrl,
}: PromoPausedNoticeEmailProps) => {
  const planName = PLAN_NAMES[upgrade.plan];
  const upgradeLimit = PLAN_CAPS[upgrade.plan].eventsLimit;
  const visits = `${dropped.toLocaleString()} ${dropped === 1 ? "click" : "clicks"}`;

  return (
    <EmailLayout
      preview={`${visits} to your links ${dropped === 1 ? "wasn't" : "weren't"} recorded since ${pausedOn}`}
      notificationSettingsUrl={notificationSettingsUrl}
    >
      <Text style={text}>Hi {displayName(userName) ?? "there"},</Text>

      <Text style={text}>
        Analytics on your iShortn links have been paused since {pausedOn}, when the Free plan&apos;s
        monthly allowance of tracked clicks ran out. Since then, {visits} went through to your links
        but {dropped === 1 ? "wasn't" : "weren't"} recorded. Your links keep redirecting as normal.
      </Text>

      <Text style={text}>
        Counting resumes on its own on {resumesOn}, when the allowance resets.
      </Text>

      <Text style={text}>
        {upgradeLimit === undefined
          ? `${planName} has no monthly cap on tracked clicks`
          : `${planName} includes ${upgradeLimit.toLocaleString()} tracked clicks a month`}{" "}
        and restores tracking as soon as the subscription starts. {promoOfferLine(promo, planName)}
      </Text>

      <EmailButton href={upgrade.url}>{upgrade.label}</EmailButton>

      <Text style={text}>
        If the Free plan suits you, there&apos;s nothing to do. Reply to this email if you have any
        questions.
      </Text>

      <Signoff />
    </EmailLayout>
  );
};

PromoPausedNoticeEmail.PreviewProps = {
  userName: "Ama",
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
