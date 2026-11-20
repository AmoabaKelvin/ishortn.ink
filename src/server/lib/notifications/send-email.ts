import { logger } from "@/lib/logger";

import { resend } from "./resend-client";

import type { UnsubscribeHeaders } from "./unsubscribe";
import type { Context } from "@/lib/logger/shared";
import type { ReactElement } from "react";
import type { CreateEmailOptions, CreateEmailResponse } from "resend";

export const EMAIL_FROM = "Kelvin from iShortn <kelvin@ishortn.ink>";

type EmailClient = {
  emails: { send: (payload: CreateEmailOptions) => Promise<CreateEmailResponse> };
};

type ErrorLog = { error: (fields: Context, message: string) => void };

export type SendEmailInput = {
  /** Template name, for logs. */
  template: string;
  /** User id of the recipient, when they have an account. */
  recipientId: string | null;
  to: string;
  subject: string;
  react: ReactElement;
  headers?: UnsubscribeHeaders;
  /** Extra fields for the failure log line. */
  context?: Context;
};

/**
 * Sends one email and reports whether Resend accepted it. Resend v3 returns
 * API failures as `{ error }` instead of throwing, so both paths are logged.
 */
export async function deliverEmail(
  client: EmailClient | null,
  log: ErrorLog,
  { template, recipientId, context, ...payload }: SendEmailInput,
): Promise<boolean> {
  if (!client) return false;

  try {
    const { error } = await client.emails.send({ from: EMAIL_FROM, ...payload });
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

export function sendEmail(input: SendEmailInput): Promise<boolean> {
  return deliverEmail(resend, log, input);
}
