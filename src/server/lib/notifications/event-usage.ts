import { Resend } from "resend";

import { env } from "@/env.mjs";
import EventUsageAlertEmail from "@/emails/event-usage-alert";

import type { Plan } from "@/lib/billing/plans";

type SendEventUsageEmailInput = {
  email: string;
  name?: string | null;
  threshold: number;
  limit: number;
  currentCount: number;
  plan: Plan;
};

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

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
      from: "Kelvin <kelvin@ishortn.ink>",
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
    console.error("Failed to send event usage email", error);
  }
}
