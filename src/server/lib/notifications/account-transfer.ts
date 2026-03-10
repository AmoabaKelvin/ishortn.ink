import AccountTransferEmail from "@/emails/account-transfer";
import TransferCompletedEmail from "@/emails/transfer-completed";
import TransferDeclinedEmail from "@/emails/transfer-declined";

import type { ResourceCounts } from "@/server/api/routers/account-transfer/account-transfer.service";

import { resend } from "./resend-client";

type SendAccountTransferEmailInput = {
  toEmail: string;
  toName?: string | null;
  fromEmail: string;
  fromName: string;
  token: string;
  resourceCounts: ResourceCounts;
};

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
      subject: `${fromName} wants to transfer their iShortn resources to you`,
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

type SendTransferCompletedEmailInput = {
  toEmail: string;
  toName?: string | null;
  recipientName: string;
  recipientEmail: string;
  resourceCounts: ResourceCounts;
};

export async function sendTransferCompletedEmail({
  toEmail,
  toName,
  recipientName,
  recipientEmail,
  resourceCounts,
}: SendTransferCompletedEmailInput) {
  if (!resend) return;

  try {
    await resend.emails.send({
      from: "Kelvin from iShortn <kelvin@ishortn.ink>",
      to: toEmail,
      subject: "Your iShortn resources have been transferred",
      react: TransferCompletedEmail({
        senderName: toName,
        recipientName,
        recipientEmail,
        resourceCounts,
      }),
    });
  } catch (error) {
    console.error("Failed to send transfer completed email", error);
  }
}

type SendTransferDeclinedEmailInput = {
  toEmail: string;
  toName?: string | null;
  recipientName: string;
  recipientEmail: string;
};

export async function sendTransferDeclinedEmail({
  toEmail,
  toName,
  recipientName,
  recipientEmail,
}: SendTransferDeclinedEmailInput) {
  if (!resend) return;

  try {
    await resend.emails.send({
      from: "Kelvin from iShortn <kelvin@ishortn.ink>",
      to: toEmail,
      subject: "Your iShortn transfer request was declined",
      react: TransferDeclinedEmail({
        senderName: toName,
        recipientName,
        recipientEmail,
      }),
    });
  } catch (error) {
    console.error("Failed to send transfer declined email", error);
  }
}
