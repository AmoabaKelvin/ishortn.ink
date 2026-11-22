import SubscriptionCancelledEmail from "@/emails/subscription-cancelled";
import WelcomeEmail from "@/emails/welcome-to-pro";
import { getAppUrl } from "@/lib/constants/domains";

import { sendEmail } from "./send-email";

import type { Plan } from "@/lib/billing/plans";

type PaidPlan = Exclude<Plan, "free">;

const PLAN_NAMES = { pro: "Pro", ultra: "Ultra" } satisfies Record<PaidPlan, string>;

export type BillingRecipient = { userId: string; email: string; name?: string | null };

export function sendWelcomeEmail({ userId, email, name }: BillingRecipient, plan: PaidPlan) {
  return sendEmail({
    template: "welcome-to-pro",
    recipientId: userId,
    to: email,
    essential: true,
    subject: `Welcome to iShortn ${PLAN_NAMES[plan]}`,
    react: WelcomeEmail({ userName: name, plan }),
    context: { plan },
  });
}

export function sendSubscriptionCancelledEmail(
  { userId, email, name }: BillingRecipient,
  plan: PaidPlan,
  endsAt: Date | null,
) {
  return sendEmail({
    template: "subscription-cancelled",
    recipientId: userId,
    to: email,
    essential: true,
    subject: `Your iShortn ${PLAN_NAMES[plan]} subscription has been cancelled`,
    react: SubscriptionCancelledEmail({
      userName: name,
      planName: PLAN_NAMES[plan],
      accessUntil: endsAt
        ? endsAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
        : null,
      billingUrl: getAppUrl("/dashboard/settings#billing"),
    }),
    context: { plan },
  });
}
