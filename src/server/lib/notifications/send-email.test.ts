import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { createElement } from "react";

import {
  deliverEmail,
  EMAIL_FROM,
  EMAIL_REPLY_TO,
  type SendEmailInput,
  withReplyTo,
  withSenderName,
} from "./send-email";

import type { Context } from "@/lib/logger/shared";
import type { CreateEmailOptions, CreateEmailResponse } from "resend";

const input: SendEmailInput = {
  template: "team-invite",
  recipientId: "user_123",
  to: "ama@example.com",
  essential: true,
  subject: "Join Acme on iShortn",
  react: createElement("p", null, "Hi"),
};

function recordingLog() {
  const calls: Array<{ fields: Context; message: string }> = [];
  const info: Array<{ fields: Context; message: string }> = [];
  return {
    calls,
    info: (fields: Context, message: string) => info.push({ fields, message }),
    infoCalls: info,
    error: (fields: Context, message: string) => calls.push({ fields, message }),
  };
}

const notSuppressed = async () => false;
const suppressed = (address: string) => async (email: string) => email === address;

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

    expect(await deliverEmail(client, log, input, notSuppressed)).toBe(false);
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
      await deliverEmail(
        clientReturning(err),
        log,
        { ...input, context: { teamSlug: "acme" } },
        notSuppressed,
      ),
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

    expect(await deliverEmail(client, log, input, notSuppressed)).toBe(true);
    expect(log.calls).toEqual([]);
    expect(client.sent[0]).toMatchObject({
      from: EMAIL_FROM,
      to: input.to,
      subject: input.subject,
    });
    expect(client.sent[0]).not.toHaveProperty("template");
  });

  test("sets reply_to to the monitored inbox from EMAIL_REPLY_TO", async () => {
    const client = clientReturning({ data: { id: "email_1" }, error: null });

    expect(await deliverEmail(client, recordingLog(), input, notSuppressed)).toBe(true);
    expect(EMAIL_REPLY_TO).toBe("replies@mail.ishortn.ink");
    expect(client.sent[0]?.reply_to).toBe(EMAIL_REPLY_TO);
  });

  test("sends from the given sender when one is set", async () => {
    const client = clientReturning({ data: { id: "email_1" }, error: null });
    const from = "iShortn <updates@mail.example.com>";

    expect(await deliverEmail(client, recordingLog(), { ...input, from }, notSuppressed)).toBe(
      true,
    );
    expect(client.sent[0]?.from).toBe(from);
  });

  test("reports failure when no client is configured", async () => {
    expect(await deliverEmail(null, recordingLog(), input, notSuppressed)).toBe(false);
  });

  test("skips a non-essential email to a suppressed address", async () => {
    const log = recordingLog();
    const client = clientReturning({ data: { id: "email_1" }, error: null });
    const notice = { ...input, template: "link-milestone", essential: false };

    expect(await deliverEmail(client, log, notice, suppressed("ama@example.com"))).toBe(false);
    expect(client.sent).toEqual([]);
    expect(log.infoCalls).toEqual([
      {
        fields: { template: "link-milestone", recipientId: "user_123" },
        message: "email skipped: address suppressed",
      },
    ]);
  });

  test("still sends a non-essential email to an address that isn't suppressed", async () => {
    const client = clientReturning({ data: { id: "email_1" }, error: null });
    const notice = { ...input, essential: false };

    expect(await deliverEmail(client, recordingLog(), notice, suppressed("kofi@example.com"))).toBe(
      true,
    );
    expect(client.sent).toHaveLength(1);
  });

  test("attempts an essential email even when the address is suppressed", async () => {
    const client = clientReturning({ data: { id: "email_1" }, error: null });
    let checked = false;
    const isSuppressed = async () => {
      checked = true;
      return true;
    };

    expect(await deliverEmail(client, recordingLog(), input, isSuppressed)).toBe(true);
    expect(client.sent).toHaveLength(1);
    expect(checked).toBe(false);
  });

  test("sends when the suppression check fails, and logs it", async () => {
    const log = recordingLog();
    const client = clientReturning({ data: { id: "email_1" }, error: null });
    const failing = async (): Promise<boolean> => {
      throw new Error("db down");
    };

    expect(await deliverEmail(client, log, { ...input, essential: false }, failing)).toBe(true);
    expect(log.calls[0]?.message).toBe("email suppression check failed");
  });
});

describe("withSenderName", () => {
  test("puts one sender's display name on another's address", () => {
    expect(
      withSenderName(
        "iShortn <hello@updates.ishortn.ink>",
        "Kelvin from iShortn <kelvin@ishortn.ink>",
      ),
    ).toBe("Kelvin from iShortn <hello@updates.ishortn.ink>");
  });

  test("handles a bare address on either side", () => {
    expect(withSenderName("hello@updates.ishortn.ink", "iShortn <notifications@ishortn.ink>")).toBe(
      "iShortn <hello@updates.ishortn.ink>",
    );
    expect(withSenderName("iShortn <hello@updates.ishortn.ink>", "kelvin@ishortn.ink")).toBe(
      "hello@updates.ishortn.ink",
    );
  });
});

describe("every Resend send", () => {
  const SRC = path.join(import.meta.dir, "../../..");
  const sources = readdirSync(SRC, { recursive: true, encoding: "utf8" }).filter(
    (file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file),
  );
  const senders = sources.filter((file) =>
    /\.(emails|batch)\.send\(/.test(readFileSync(path.join(SRC, file), "utf8")),
  );

  test("finds the senders", () => {
    expect(senders.length).toBeGreaterThanOrEqual(4);
  });

  for (const file of senders) {
    test(`${file} sets reply_to through withReplyTo`, () => {
      expect(readFileSync(path.join(SRC, file), "utf8")).toContain("withReplyTo(");
    });
  }

  test("withReplyTo keeps the payload and adds reply_to", () => {
    expect(withReplyTo({ to: "ama@example.com" })).toEqual({
      to: "ama@example.com",
      reply_to: EMAIL_REPLY_TO,
    });
  });
});
