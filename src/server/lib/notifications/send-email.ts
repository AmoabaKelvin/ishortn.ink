import { env } from "@/env.mjs";
import { logger } from "@/lib/logger";

import { renderEmail } from "./render-email";
import { getResend } from "./resend-client";
import { isEmailSuppressed } from "./suppression";

import type { UnsubscribeHeaders } from "./unsubscribe";
import type { Context } from "@/lib/logger/shared";
import type { ReactElement } from "react";
import type { CreateEmailOptions, CreateEmailResponse } from "resend";

/** Founder voice: welcome, nudges, plan changes. Also the default for sendEmail. */
export const EMAIL_FROM = env.EMAIL_FROM ?? "Kelvin from iShortn <kelvin@ishortn.ink>";

/** System notices: reports, cap alerts, plan grace, domain, account, team and transfer emails. */
export const EMAIL_FROM_SYSTEM = env.EMAIL_FROM_SYSTEM ?? "iShortn <notifications@ishortn.ink>";

/** The monitored inbox that replies to every product email go to. */
export const EMAIL_REPLY_TO = env.EMAIL_REPLY_TO;

/** Adds `reply_to: EMAIL_REPLY_TO`; every Resend send goes through this. */
export function withReplyTo<T extends object>(payload: T): T & { reply_to?: string } {
  return EMAIL_REPLY_TO ? { ...payload, reply_to: EMAIL_REPLY_TO } : payload;
}

/**
 * `from` under the display name of `nameFrom`, keeping `from`'s address so the email still leaves
 * from its own sending domain (lifecycle email has a separate subdomain).
 */
export function withSenderName(from: string, nameFrom: string): string {
  const address = from.match(/<([^>]+)>/)?.[1] ?? from.trim();
  const name = nameFrom.match(/^(.*?)\s*</)?.[1]?.trim();
  return name ? `${name} <${address}>` : address;
}

type EmailClient = {
  emails: { send: (payload: CreateEmailOptions) => Promise<CreateEmailResponse> };
};

type EmailLog = {
  error: (fields: Context, message: string) => void;
  info: (fields: Context, message: string) => void;
};

type SuppressionCheck = (email: string) => Promise<boolean>;

export type SendEmailInput = {
  /** Template name, for logs. */
  template: string;
  /** User id of the recipient, when they have an account. */
  recipientId: string | null;
  to: string;
  /**
   * Security, billing and requested emails (invites, transfers) are always attempted. The rest
   * (lifecycle, plan notices, recurring reports) skip addresses that hard-bounced or complained.
   */
  essential: boolean;
  /** Defaults to the transactional sender, EMAIL_FROM. */
  from?: string;
  subject: string;
  react: ReactElement;
  headers?: UnsubscribeHeaders;
  /** Extra fields for the failure log line. */
  context?: Context;
};

/**
 * Sends one email, with HTML and plain-text parts, and reports whether Resend accepted it.
 * Resend v3 returns API failures as `{ error }` instead of throwing, so both paths are logged.
 */
export async function deliverEmail(
  client: EmailClient | null,
  log: EmailLog,
  {
    template,
    recipientId,
    context,
    essential,
    from = EMAIL_FROM,
    react,
    ...payload
  }: SendEmailInput,
  isSuppressed: SuppressionCheck,
): Promise<boolean> {
  if (!client) return false;

  if (!essential) {
    try {
      if (await isSuppressed(payload.to)) {
        log.info({ ...context, template, recipientId }, "email skipped: address suppressed");
        return false;
      }
    } catch (err) {
      // Fail open: a missed suppression costs one bounce, a dropped notice is silent.
      log.error(
        { ...context, template, recipientId, err: err instanceof Error ? err : String(err) },
        "email suppression check failed",
      );
    }
  }

  try {
    const { error } = await client.emails.send(
      withReplyTo({ from, ...payload, ...(await renderEmail(react, payload.to)) }),
    );
    if (!error) return true;
    log.error(
      { ...context, template, recipientId, err: { name: error.name, message: error.message } },
      "email send failed",
    );
  } catch (err) {
    log.error(
      { ...context, template, recipientId, err: err instanceof Error ? err : String(err) },
      "email send failed",
    );
  }
  return false;
}

const log = logger.child({ component: "email" });

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  return deliverEmail(await getResend(), log, input, isEmailSuppressed);
}
