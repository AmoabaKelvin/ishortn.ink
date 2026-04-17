import EventUsageAlertEmail from "@/emails/event-usage-alert";
import { logger } from "@/lib/logger";

import type { Plan } from "@/lib/billing/plans";

import { resend } from "./resend-client";

const log = logger.child({ notification: "event-usage" });

type SendEventUsageEmailInput = {
  email: string;
  name?: string | null;
  threshold: number;
  limit: number;
  currentCount: number;
  plan: Plan;
};

export async function sendEventUsageEmail({
  email,
  name,
  threshold,
  limit,
  currentCount,
  plan,
}: SendEventUsageEmailInput) {
  if (!resend) return;

  try {
    await resend.emails.send({
      from: "Kelvin from iShortn <kelvin@ishortn.ink>",
      to: email,
      subject: `You're ${threshold}% through your monthly analytics cap`,
      react: EventUsageAlertEmail({
        userName: name,
        threshold,
        limit,
        currentCount,
        plan,
      }),
    });
  } catch (error) {
    log.error(
      { err: error, email, threshold, plan },
      "failed to send event usage email",
    );
  }
}
