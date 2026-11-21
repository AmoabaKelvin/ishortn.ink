import { describe, expect, test } from "bun:test";

import { normalizeEmail, resendEmailEventSchema, suppressionActionFor } from "./suppression-event";

const NOW = new Date("2026-11-21T12:00:00Z");
const AT = "2026-11-21T10:00:00.000Z";

type EventData = {
  to?: string | string[];
  bounce?: { type?: string; subType?: string; message?: string };
};

function event(type: string, data: EventData = {}, createdAt: string | undefined = AT) {
  return resendEmailEventSchema.parse({
    type,
    created_at: createdAt,
    data: { email_id: "e_1", to: ["Ama@Example.com"], ...data },
  });
}

describe("normalizeEmail", () => {
  test("lowercases and strips a display name", () => {
    expect(normalizeEmail("Ama Mensah <AMA@example.com>")).toBe("ama@example.com");
    expect(normalizeEmail("  Kofi@Example.COM ")).toBe("kofi@example.com");
  });
});

describe("resendEmailEventSchema", () => {
  test("accepts a single recipient string and rejects non-events", () => {
    expect(event("email.delivered", { to: "ama@example.com" }).data.to).toEqual([
      "ama@example.com",
    ]);
    expect(resendEmailEventSchema.safeParse({ hello: "world" }).success).toBe(false);
  });
});

describe("suppressionActionFor", () => {
  test("a permanent bounce suppresses the recipient with the bounce detail", () => {
    const action = suppressionActionFor(
      event("email.bounced", {
        bounce: { type: "Permanent", subType: "General", message: "Mailbox does not exist" },
      }),
      NOW,
    );
    expect(action).toEqual({
      kind: "suppress",
      type: "bounced",
      emails: ["ama@example.com"],
      at: new Date(AT),
      detail: "General: Mailbox does not exist",
    });
  });

  test("a temporary bounce is ignored", () => {
    expect(
      suppressionActionFor(
        event("email.bounced", { bounce: { type: "Temporary", subType: "MailboxFull" } }),
        NOW,
      ),
    ).toEqual({ kind: "ignore" });
  });

  test("a bounce without a bounce object counts as hard", () => {
    expect(suppressionActionFor(event("email.bounced"), NOW)).toMatchObject({
      kind: "suppress",
      type: "bounced",
      detail: null,
    });
  });

  test("a complaint suppresses every recipient once", () => {
    expect(
      suppressionActionFor(
        event("email.complained", { to: ["a@example.com", "A@example.com", "b@example.com"] }),
        NOW,
      ),
    ).toEqual({
      kind: "suppress",
      type: "complained",
      emails: ["a@example.com", "b@example.com"],
      at: new Date(AT),
      detail: null,
    });
  });

  test("a delivery clears", () => {
    expect(suppressionActionFor(event("email.delivered"), NOW)).toEqual({
      kind: "clear",
      emails: ["ama@example.com"],
      at: new Date(AT),
    });
  });

  test("falls back to now without a created_at", () => {
    expect(suppressionActionFor(event("email.delivered", {}, undefined), NOW)).toMatchObject({
      at: NOW,
    });
  });

  test("other events and events without recipients are ignored", () => {
    expect(suppressionActionFor(event("email.opened"), NOW)).toEqual({ kind: "ignore" });
    expect(suppressionActionFor(event("email.bounced", { to: [] }), NOW)).toEqual({
      kind: "ignore",
    });
  });
});
