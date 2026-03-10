import DomainReminderEmail from "@/emails/domain-reminder";
import { env } from "@/env.mjs";

import { resend } from "./resend-client";

type Challenge = {
  type: "TXT" | "A" | "CNAME";
  domain: string;
  value: string;
};

type SendDomainReminderEmailInput = {
  email: string;
  recipientName?: string | null;
  domain: string;
  daysMisconfigured: number;
  challenges: Challenge[];
};

export async function sendDomainReminderEmail({
  email,
  recipientName,
  domain,
  daysMisconfigured,
  challenges,
}: SendDomainReminderEmailInput) {
  if (!resend) return;

  const dashboardUrl = `${env.NEXT_PUBLIC_APP_URL}/dashboard/domains`;

  try {
    await resend.emails.send({
      from: "Kelvin from iShortn <kelvin@ishortn.ink>",
      to: email,
      subject: `${domain} needs configuration on iShortn`,
      react: DomainReminderEmail({
        recipientName,
        domain,
        daysMisconfigured,
        challenges,
        dashboardUrl,
      }),
    });
  } catch (error) {
    console.error("Failed to send domain reminder email", error);
  }
}
