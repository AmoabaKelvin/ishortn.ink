import AccountTransferEmail from "@/emails/account-transfer";
import TransferCompletedEmail from "@/emails/transfer-completed";
import TransferDeclinedEmail from "@/emails/transfer-declined";
import { getAppUrl } from "@/lib/constants/domains";

import { EMAIL_FROM_SYSTEM, sendEmail } from "./send-email";

import type { ResourceCounts } from "@/server/api/routers/account-transfer/account-transfer.service";

type SendAccountTransferEmailInput = {
  toEmail: string;
  toUserId: string;
  toName?: string | null;
  fromEmail: string;
  fromName: string;
  acceptUrl: string;
  resourceCounts: ResourceCounts;
};

/** Resolves to false when the email could not be sent, so the caller can offer the link instead. */
export function sendAccountTransferEmail({
  toEmail,
  toUserId,
  toName,
  fromEmail,
  fromName,
  acceptUrl,
  resourceCounts,
}: SendAccountTransferEmailInput): Promise<boolean> {
  return sendEmail({
    template: "account-transfer",
    from: EMAIL_FROM_SYSTEM,
    recipientId: toUserId,
    to: toEmail,
    essential: true,
    subject: `${fromName} wants to transfer their iShortn resources to you`,
    react: AccountTransferEmail({
      recipientName: toName,
      senderName: fromName,
      senderEmail: fromEmail,
      acceptUrl,
      resourceCounts,
    }),
  });
}

type SendTransferCompletedEmailInput = {
  toEmail: string;
  toUserId: string;
  toName?: string | null;
  recipientName: string;
  recipientEmail: string;
  resourceCounts: ResourceCounts;
};

export function sendTransferCompletedEmail({
  toEmail,
  toUserId,
  toName,
  recipientName,
  recipientEmail,
  resourceCounts,
}: SendTransferCompletedEmailInput): Promise<boolean> {
  return sendEmail({
    template: "transfer-completed",
    from: EMAIL_FROM_SYSTEM,
    recipientId: toUserId,
    to: toEmail,
    essential: true,
    subject: "Your iShortn resources have been transferred",
    react: TransferCompletedEmail({
      senderName: toName,
      recipientName,
      recipientEmail,
      resourceCounts,
      dashboardUrl: getAppUrl("/dashboard"),
    }),
  });
}

type SendTransferDeclinedEmailInput = {
  toEmail: string;
  toUserId: string;
  toName?: string | null;
  recipientName: string;
  recipientEmail: string;
};

export function sendTransferDeclinedEmail({
  toEmail,
  toUserId,
  toName,
  recipientName,
  recipientEmail,
}: SendTransferDeclinedEmailInput): Promise<boolean> {
  return sendEmail({
    template: "transfer-declined",
    from: EMAIL_FROM_SYSTEM,
    recipientId: toUserId,
    to: toEmail,
    essential: true,
    subject: "Your iShortn transfer request was declined",
    react: TransferDeclinedEmail({
      senderName: toName,
      recipientName,
      recipientEmail,
      transferSettingsUrl: getAppUrl("/dashboard/settings#account-transfer"),
    }),
  });
}
