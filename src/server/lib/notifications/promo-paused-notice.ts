import PromoPausedNoticeEmail from "@/emails/promo-paused-notice";
import { EMAIL_LINKS, emailLinkUrl } from "@/lib/email/links";

import { EMAIL_FROM_SYSTEM, sendEmail } from "./send-email";
import { productNotificationOptions } from "./unsubscribe";

import type { Promo } from "@/lib/billing/promo";

export type SendPromoPausedNoticeInput = {
  userId: string;
  email: string;
  name: string | null;
  dropped: number;
  pausedAt: Date;
  resetsAt: Date;
  target: "pro" | "ultra";
  promo: Promo;
};

const UPGRADE_LABELS = { pro: "Upgrade to Pro", ultra: "Upgrade to Ultra" } as const;

// Workers run in UTC, and the pause date and monthly reset are UTC instants.
const formatDay = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });

export function promoPausedNoticeUrl(target: "pro" | "ultra"): string {
  return emailLinkUrl(EMAIL_LINKS.promoPaused[target]);
}

/** Returns whether Resend accepted the email. */
export function sendPromoPausedNotice({
  userId,
  email,
  name,
  dropped,
  pausedAt,
  resetsAt,
  target,
  promo,
}: SendPromoPausedNoticeInput): Promise<boolean> {
  const { notificationSettingsUrl, headers } = productNotificationOptions(userId);

  return sendEmail({
    template: "promo-paused-notice",
    from: EMAIL_FROM_SYSTEM,
    recipientId: userId,
    to: email,
    essential: false,
    subject: "Visits to your links are still not being recorded",
    react: PromoPausedNoticeEmail({
      userName: name,
      dropped,
      pausedOn: formatDay(pausedAt),
      resumesOn: formatDay(resetsAt),
      promo,
      upgrade: {
        plan: target,
        label: UPGRADE_LABELS[target],
        url: promoPausedNoticeUrl(target),
      },
      notificationSettingsUrl,
    }),
    headers,
    context: { promo: promo.code, target },
  });
}
