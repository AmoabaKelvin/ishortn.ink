import { Text } from "@react-email/components";

import { PLAN_CAPS } from "@/lib/billing/plans";
import { PLAN_PRICES_ANNUAL_USD, PLAN_PRICES_USD } from "@/lib/constants/plan-pricing";
import { EMAIL_LINKS, emailLinkUrl } from "@/lib/email/links";

import { EmailButton, EmailLayout, text } from "./_components/layout";
import { formatClicks } from "./weekly-summary";

/** The one angle an upgrade nudge leads with; dates are already formatted ("27 November"). */
export type UpgradeNudgeAngle =
  | { reason: "limit_hit"; feature: string; hitDate: string }
  | { reason: "events"; monthlyEventCount: number; projectedDate: string; resetDate: string }
  | { reason: "links"; monthlyLinkCount: number; resetDate: string }
  | {
      reason: "analytics";
      firstClickDate: string;
      viewEndDate: string;
      /** The first clicks are already outside the Free analytics window. */
      ended: boolean;
      viewStartDate: string;
    }
  | { reason: "domain" };

export type UpgradeNudgeReason = UpgradeNudgeAngle["reason"];

export type UpgradeNudgeEmailProps = {
  userName?: string | null;
  signupDate: string;
  linkCount: number;
  clickCount: number;
  angle: UpgradeNudgeAngle;
  /** Shown only while a promo runs. */
  promoLine: string | null;
  upgradeUrl: string;
  unsubscribeUrl: string | null;
  notificationSettingsUrl: string;
};

const free = PLAN_CAPS.free;
const pro = PLAN_CAPS.pro;
const fmt = (n: number | undefined) => (n ?? 0).toLocaleString("en-US");
const formatLinks = (count: number) => `${fmt(count)} ${count === 1 ? "link" : "links"}`;

export function upgradeNudgeSubject(angle: UpgradeNudgeAngle): string {
  switch (angle.reason) {
    case "limit_hit":
      return `${angle.feature.charAt(0).toUpperCase()}${angle.feature.slice(1)} is part of Pro`;
    case "events":
      return `Your links are on pace to pass ${fmt(free.eventsLimit)} tracked clicks this month`;
    case "links":
      return `You've used ${fmt(angle.monthlyLinkCount)} of your ${fmt(free.linksLimit)} free links this month`;
    case "analytics":
      return `Your first clicks are ${angle.ended ? "outside" : "leaving"} the ${free.analyticsRangeLimitDays}-day view`;
    case "domain":
      return "Your links could be on your own domain";
  }
}

/** The angle's paragraph, one sentence per entry; the first is the preview text. */
export function upgradeNudgeSentences(angle: UpgradeNudgeAngle): string[] {
  const days = free.analyticsRangeLimitDays;
  switch (angle.reason) {
    case "limit_hit":
      return [`On ${angle.hitDate} you tried ${angle.feature}.`, "That comes with Pro."];
    case "events":
      return [
        `Free includes ${fmt(free.eventsLimit)} tracked clicks a month.`,
        `Your links are at ${fmt(angle.monthlyEventCount)}, so at this pace they'll pass it around ${angle.projectedDate}.`,
        `After that they keep working, but new clicks won't show in your analytics until the count resets on ${angle.resetDate}.`,
        `Pro includes ${fmt(pro.eventsLimit)} tracked clicks a month.`,
      ];
    case "links":
      return [
        `Free includes ${fmt(free.linksLimit)} new links a month and you've used ${fmt(angle.monthlyLinkCount)}.`,
        `Your count resets on ${angle.resetDate}.`,
        `Pro includes ${fmt(pro.linksLimit)} new links a month.`,
      ];
    case "analytics":
      return angle.ended
        ? [
            `Free shows the last ${days} days of clicks, so your clicks from before ${angle.viewStartDate} are already out of view.`,
            "Pro shows all of them.",
          ]
        : [
            `Free shows the last ${days} days of clicks.`,
            `Your first clicks came in on ${angle.firstClickDate}, so they drop out of your dashboard on ${angle.viewEndDate}.`,
            "Pro shows all of them.",
          ];
    case "domain":
      return [
        "With Pro your links can use your own domain, like go.yourbrand.com, instead of ours.",
        `You can connect up to ${fmt(pro.domainLimit)}.`,
      ];
  }
}

export const UpgradeNudgeEmail = ({
  userName,
  signupDate,
  linkCount,
  clickCount,
  angle,
  promoLine,
  upgradeUrl,
  unsubscribeUrl,
  notificationSettingsUrl,
}: UpgradeNudgeEmailProps) => {
  const sentences = upgradeNudgeSentences(angle);

  return (
    <EmailLayout
      variant="letter"
      recipientName={userName}
      preview={sentences[0] ?? ""}
      notificationSettingsUrl={notificationSettingsUrl}
      footerReason="You're getting this one-time email because you have an iShortn account with product emails turned on."
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={text}>
        {clickCount > 0
          ? `You've made ${formatLinks(linkCount)} since you joined iShortn on ${signupDate}, and they've had ${formatClicks(clickCount)} so far.`
          : `You've made ${formatLinks(linkCount)} since you joined iShortn on ${signupDate}.`}
      </Text>

      <Text style={text}>{sentences.join(" ")}</Text>

      <Text style={text}>
        {`Pro is $${PLAN_PRICES_USD.pro} a month, or $${PLAN_PRICES_ANNUAL_USD.pro} a year.`}
        {promoLine && ` ${promoLine}`}
      </Text>

      <EmailButton href={upgradeUrl}>Compare plans</EmailButton>

      <Text style={text}>
        If Free covers what you need, keep using it. Nothing changes, and I won&apos;t send you this
        email again.
      </Text>

      <Text style={{ ...text, fontWeight: 500 }}>Kelvin</Text>
    </EmailLayout>
  );
};

UpgradeNudgeEmail.PreviewProps = {
  userName: "Ama",
  signupDate: "18 November",
  linkCount: 6,
  clickCount: 142,
  angle: { reason: "limit_hit", feature: "custom domains", hitDate: "21 November" },
  promoLine:
    "Black Friday: Pro is 20% off your first year until Tuesday 1 December. The discount is applied at checkout.",
  upgradeUrl: emailLinkUrl(EMAIL_LINKS.upgradeNudge.limit_hit),
  unsubscribeUrl: "https://ishortn.ink/api/email/unsubscribe?token=user_1.sig",
  notificationSettingsUrl: "https://ishortn.ink/dashboard/settings#notifications",
} satisfies UpgradeNudgeEmailProps;

/** One preview per angle, for the email preview and the template tests. */
export const UPGRADE_NUDGE_PREVIEWS = {
  limit_hit: UpgradeNudgeEmail.PreviewProps,
  events: {
    ...UpgradeNudgeEmail.PreviewProps,
    clickCount: 640,
    angle: {
      reason: "events",
      monthlyEventCount: 640,
      projectedDate: "27 November",
      resetDate: "1 December",
    },
    upgradeUrl: emailLinkUrl(EMAIL_LINKS.upgradeNudge.events),
  },
  links: {
    ...UpgradeNudgeEmail.PreviewProps,
    linkCount: 18,
    angle: { reason: "links", monthlyLinkCount: 18, resetDate: "1 December" },
    upgradeUrl: emailLinkUrl(EMAIL_LINKS.upgradeNudge.links),
  },
  analytics: {
    ...UpgradeNudgeEmail.PreviewProps,
    angle: {
      reason: "analytics",
      firstClickDate: "19 November",
      viewEndDate: "26 November",
      ended: false,
      viewStartDate: "16 November",
    },
    promoLine: null,
    upgradeUrl: emailLinkUrl(EMAIL_LINKS.upgradeNudge.analytics),
  },
  domain: {
    ...UpgradeNudgeEmail.PreviewProps,
    linkCount: 3,
    clickCount: 0,
    angle: { reason: "domain" },
    promoLine: null,
    upgradeUrl: emailLinkUrl(EMAIL_LINKS.upgradeNudge.domain),
  },
} satisfies Record<UpgradeNudgeReason, UpgradeNudgeEmailProps>;

export default UpgradeNudgeEmail;
