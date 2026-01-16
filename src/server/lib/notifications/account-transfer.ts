import { Resend } from "resend";

import { env } from "@/env.mjs";
import AccountTransferEmail from "@/emails/account-transfer";

import type { ResourceCounts } from "@/server/api/routers/account-transfer/account-transfer.service";

type SendAccountTransferEmailInput = {
  toEmail: string;
  toName?: string | null;
  fromEmail: string;
  fromName: string;
  token: string;
  resourceCounts: ResourceCounts;
};

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendAccountTransferEmail({
  toEmail,
  toName,
  fromEmail,
  fromName,
  token,
  resourceCounts,
}: SendAccountTransferEmailInput) {
  if (!resend) return;

  const baseDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || "ishortn.ink";
  const acceptUrl = `https://${baseDomain}/account/accept-transfer?token=${encodeURIComponent(token)}`;

  try {
    await resend.emails.send({
      from: "Kelvin from iShortn <kelvin@ishortn.ink>",
      to: toEmail,
      subject: `${fromName} wants to transfer their iShortn account to you`,
      react: AccountTransferEmail({
        recipientName: toName,
        senderName: fromName,
        senderEmail: fromEmail,
        acceptUrl,
        resourceCounts,
      }),
    });
  } catch (error) {
    console.error("Failed to send account transfer email", error);
  }
}
