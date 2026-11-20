import { describe, expect, test } from "bun:test";

import { createElement } from "react";

import { deliverEmail, EMAIL_FROM, type SendEmailInput } from "./send-email";

import type { Context } from "@/lib/logger/shared";
import type { CreateEmailOptions, CreateEmailResponse } from "resend";

const input: SendEmailInput = {
  template: "team-invite",
  recipientId: "user_123",
  to: "ama@example.com",
  subject: "Join Acme on iShortn",
  react: createElement("p", null, "Hi"),
};

function recordingLog() {
  const calls: Array<{ fields: Context; message: string }> = [];
  return {
    calls,
    error: (fields: Context, message: string) => calls.push({ fields, message }),
  };
}

function clientReturning(result: CreateEmailResponse | Error) {
  const sent: CreateEmailOptions[] = [];
  return {
    sent,
    emails: {
      send: async (payload: CreateEmailOptions) => {
        sent.push(payload);
        if (result instanceof Error) throw result;
        return result;
      },
    },
  };
}

describe("deliverEmail", () => {
  test("logs an { error } result with the template and recipient id and reports failure", async () => {
    const log = recordingLog();
    const error = { name: "validation_error" as const, message: "Invalid `to` field" };
    const client = clientReturning({ data: null, error });

    expect(await deliverEmail(client, log, input)).toBe(false);
    expect(log.calls).toEqual([
      {
        fields: { template: "team-invite", recipientId: "user_123", err: error },
        message: "email send failed",
      },
    ]);
  });

  test("logs a thrown error and reports failure", async () => {
    const log = recordingLog();
    const err = new Error("network down");

    expect(
      await deliverEmail(clientReturning(err), log, { ...input, context: { teamSlug: "acme" } }),
    ).toBe(false);
    expect(log.calls[0]?.fields).toEqual({
      teamSlug: "acme",
      template: "team-invite",
      recipientId: "user_123",
      err,
    });
  });

  test("sends from the shared sender and reports success without logging", async () => {
    const log = recordingLog();
    const client = clientReturning({ data: { id: "email_1" }, error: null });

    expect(await deliverEmail(client, log, input)).toBe(true);
    expect(log.calls).toEqual([]);
    expect(client.sent[0]).toMatchObject({
      from: EMAIL_FROM,
      to: input.to,
      subject: input.subject,
    });
    expect(client.sent[0]).not.toHaveProperty("template");
  });

  test("reports failure when no client is configured", async () => {
    expect(await deliverEmail(null, recordingLog(), input)).toBe(false);
  });
});
