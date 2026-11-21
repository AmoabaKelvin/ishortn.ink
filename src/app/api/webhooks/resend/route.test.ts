import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import crypto from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import { Webhook } from "svix";

import { env } from "@/env.mjs";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { hasBouncedEmail, isEmailSuppressed } from "@/server/lib/notifications/suppression";

import { POST } from "./route";

const SECRET = `whsec_${crypto.randomBytes(24).toString("base64")}`;
const USER_ID = "resend_route_test";
const USER_EMAIL = "resend-route-test@example.com";
const STRANGER_EMAIL = "resend-route-stranger@example.com";

beforeAll(() => {
  Object.assign(env, { RESEND_WEBHOOK_SECRET: SECRET });
});

type EventData = { bounce?: { type: string; subType?: string; message?: string } };

function emailEvent(type: string, to: string, createdAt: Date, data: EventData = {}) {
  return JSON.stringify({
    type,
    created_at: createdAt.toISOString(),
    data: { email_id: crypto.randomUUID(), to: [to], subject: "Test", ...data },
  });
}

function deliver(body: string, secret = SECRET) {
  const id = `msg_${crypto.randomBytes(8).toString("hex")}`;
  const now = new Date();
  return POST(
    new Request("http://localhost/api/webhooks/resend", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "svix-id": id,
        "svix-timestamp": String(Math.floor(now.getTime() / 1000)),
        "svix-signature": new Webhook(secret).sign(id, now, body),
      },
      body,
    }),
  );
}

describe("POST /api/webhooks/resend signature", () => {
  const body = emailEvent("email.bounced", USER_EMAIL, new Date());

  test("rejects missing svix headers with 401", async () => {
    const response = await POST(
      new Request("http://localhost/api/webhooks/resend", { method: "POST", body }),
    );
    expect(response.status).toBe(401);
  });

  test("rejects a body signed with another secret with 401", async () => {
    const other = `whsec_${crypto.randomBytes(24).toString("base64")}`;
    expect((await deliver(body, other)).status).toBe(401);
  });
});

// Runs against a disposable MySQL with the schema pushed; see CONTRIBUTING.md, "Database tests".
describe.skipIf(!process.env.TEST_DATABASE_URL)("POST /api/webhooks/resend suppression", () => {
  const emails = [USER_EMAIL, STRANGER_EMAIL];

  async function cleanup() {
    await db.delete(schema.emailSuppression).where(inArray(schema.emailSuppression.email, emails));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  }

  async function rowFor(email: string, type: "bounced" | "complained") {
    const [row] = await db
      .select()
      .from(schema.emailSuppression)
      .where(and(eq(schema.emailSuppression.email, email), eq(schema.emailSuppression.type, type)));
    return row;
  }

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values({ id: USER_ID, email: USER_EMAIL, name: "Ama" });
  });

  afterAll(cleanup);

  test("a signed hard bounce suppresses the address, links the user and shows the banner", async () => {
    const at = new Date("2026-11-21T10:00:00Z");
    const response = await deliver(
      emailEvent("email.bounced", "Resend-Route-Test@Example.com", at, {
        bounce: { type: "Permanent", subType: "General", message: "Mailbox does not exist" },
      }),
    );

    expect(response.status).toBe(204);
    const row = await rowFor(USER_EMAIL, "bounced");
    expect(row).toMatchObject({
      userId: USER_ID,
      detail: "General: Mailbox does not exist",
      lastEventAt: at,
      clearedAt: null,
    });
    expect(await isEmailSuppressed(USER_EMAIL)).toBe(true);
    expect(await hasBouncedEmail(USER_ID)).toBe(true);
  });

  test("a temporary bounce changes nothing", async () => {
    await deliver(
      emailEvent("email.bounced", USER_EMAIL, new Date(), { bounce: { type: "Temporary" } }),
    );
    expect(await isEmailSuppressed(USER_EMAIL)).toBe(false);
  });

  test("a signed complaint suppresses an address without an account", async () => {
    expect((await deliver(emailEvent("email.complained", STRANGER_EMAIL, new Date()))).status).toBe(
      204,
    );
    expect(await rowFor(STRANGER_EMAIL, "complained")).toMatchObject({ userId: null });
    expect(await isEmailSuppressed(STRANGER_EMAIL)).toBe(true);
  });

  test("a later delivery clears a bounce, an earlier one doesn't", async () => {
    const bouncedAt = new Date("2026-11-21T10:00:00Z");
    await deliver(emailEvent("email.bounced", USER_EMAIL, bouncedAt));

    await deliver(emailEvent("email.delivered", USER_EMAIL, new Date("2026-11-21T09:00:00Z")));
    expect(await hasBouncedEmail(USER_ID)).toBe(true);

    await deliver(emailEvent("email.delivered", USER_EMAIL, new Date("2026-11-21T11:00:00Z")));
    expect(await hasBouncedEmail(USER_ID)).toBe(false);
    expect(await isEmailSuppressed(USER_EMAIL)).toBe(false);

    // A late copy of the original bounce doesn't undo the clear; a new bounce does.
    await deliver(emailEvent("email.bounced", USER_EMAIL, bouncedAt));
    expect(await hasBouncedEmail(USER_ID)).toBe(false);
    await deliver(emailEvent("email.bounced", USER_EMAIL, new Date("2026-11-21T12:00:00Z")));
    expect(await hasBouncedEmail(USER_ID)).toBe(true);
  });

  test("a delivery doesn't clear a complaint", async () => {
    await deliver(emailEvent("email.complained", USER_EMAIL, new Date("2026-11-21T10:00:00Z")));
    await deliver(emailEvent("email.delivered", USER_EMAIL, new Date("2026-11-21T11:00:00Z")));
    expect(await isEmailSuppressed(USER_EMAIL)).toBe(true);
  });

  test("the banner clears once the account's address changes", async () => {
    await deliver(emailEvent("email.bounced", USER_EMAIL, new Date()));
    expect(await hasBouncedEmail(USER_ID)).toBe(true);

    await db
      .update(schema.user)
      .set({ email: "resend-route-test-new@example.com" })
      .where(eq(schema.user.id, USER_ID));
    expect(await hasBouncedEmail(USER_ID)).toBe(false);
  });
});
