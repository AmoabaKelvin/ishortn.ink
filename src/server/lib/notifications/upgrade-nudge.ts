import UpgradeNudgeEmail, {
  upgradeNudgeSubject,
  type UpgradeNudgeAngle,
  type UpgradeNudgeEmailProps,
} from "@/emails/upgrade-nudge";
import { env } from "@/env.mjs";
import { getActivePromo, promoOfferLine } from "@/lib/billing/promo";
import { getAppUrl } from "@/lib/constants/domains";
import { EMAIL_LINKS, emailLinkUrl } from "@/lib/email/links";

import { EMAIL_FROM, sendEmail, withSenderName } from "./send-email";
import { buildUnsubscribeHeaders, NOTIFICATION_SETTINGS_PATH, unsubscribeUrl } from "./unsubscribe";

export type UpgradeNudgeContent = {
  name: string | null;
  signupDate: string;
  linkCount: number;
  clickCount: number;
  angle: UpgradeNudgeAngle;
};

export function upgradeNudgeUrl(reason: UpgradeNudgeAngle["reason"]): string {
  return emailLinkUrl(EMAIL_LINKS.upgradeNudge[reason]);
}

/** The email's props at `now`; the promo line is decided at send time. */
export function upgradeNudgeEmailProps(
  userId: string,
  { name, ...content }: UpgradeNudgeContent,
  now: Date,
): UpgradeNudgeEmailProps {
  const promo = getActivePromo(now);
  return {
    ...content,
    userName: name,
    promoLine: promo
      ? `${promoOfferLine(promo, "Pro")} The discount is applied at checkout.`
      : null,
    upgradeUrl: upgradeNudgeUrl(content.angle.reason),
    unsubscribeUrl: unsubscribeUrl(userId, env.EMAIL_UNSUBSCRIBE_SECRET),
    notificationSettingsUrl: getAppUrl(NOTIFICATION_SETTINGS_PATH),
  };
}

export type SendUpgradeNudgeInput = {
  userId: string;
  email: string;
  props: UpgradeNudgeEmailProps;
};

/**
 * Returns whether Resend accepted the email. Sent from the lifecycle sender, never the
 * transactional one; the caller checks EMAIL_FROM_LIFECYCLE is set.
 */
export function sendUpgradeNudgeEmail({
  userId,
  email,
  props,
}: SendUpgradeNudgeInput): Promise<boolean> {
  return sendEmail({
    template: "upgrade-nudge",
    recipientId: userId,
    to: email,
    essential: false,
    // Founder voice, from the lifecycle sending domain.
    from: env.EMAIL_FROM_LIFECYCLE && withSenderName(env.EMAIL_FROM_LIFECYCLE, EMAIL_FROM),
    subject: upgradeNudgeSubject(props.angle),
    react: UpgradeNudgeEmail(props),
    headers: buildUnsubscribeHeaders(userId, env.EMAIL_UNSUBSCRIBE_SECRET),
    context: { reason: props.angle.reason },
  });
}
