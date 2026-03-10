import LinkMilestoneEmail from "@/emails/link-milestone";

import { resend } from "./resend-client";

type SendLinkMilestoneEmailInput = {
  email: string;
  name?: string | null;
  linkAlias: string;
  linkName?: string | null;
  milestone: number;
  totalClicks: number;
};

export async function sendLinkMilestoneEmail({
  email,
  name,
  linkAlias,
  linkName,
  milestone,
  totalClicks,
}: SendLinkMilestoneEmailInput) {
  if (!resend) return;

  try {
    await resend.emails.send({
      from: "Kelvin from iShortn <kelvin@ishortn.ink>",
      to: email,
      subject: `Your link "${linkName || linkAlias}" hit ${milestone.toLocaleString()} clicks`,
      react: LinkMilestoneEmail({
        userName: name,
        linkAlias,
        linkName,
        milestone,
        totalClicks,
      }),
    });
  } catch (error) {
    console.error("Failed to send link milestone email", error);
  }
}
