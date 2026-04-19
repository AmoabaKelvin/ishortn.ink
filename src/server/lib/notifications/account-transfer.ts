import AccountTransferEmail from "@/emails/account-transfer";
import TransferCompletedEmail from "@/emails/transfer-completed";
import TransferDeclinedEmail from "@/emails/transfer-declined";
import { getAppBaseDomain } from "@/lib/constants/domains";
import { logger } from "@/lib/logger";

import type { ResourceCounts } from "@/server/api/routers/account-transfer/account-transfer.service";

import { resend } from "./resend-client";

const log = logger.child({ notification: "account-transfer" });

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

  const baseDomain = getAppBaseDomain();
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
    log.error(
      { err: error, toEmail, fromEmail, stage: "transfer-request" },
      "failed to send account transfer email",
    );
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
    log.error(
      { err: error, toEmail, recipientEmail, stage: "completed" },
      "failed to send transfer completed email",
    );
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
    log.error(
      { err: error, toEmail, recipientEmail, stage: "declined" },
      "failed to send transfer declined email",
    );
  }
}
