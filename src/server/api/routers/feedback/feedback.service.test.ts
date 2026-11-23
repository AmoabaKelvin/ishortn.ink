import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { callProcedure } from "@trpc/server";
import { eq } from "drizzle-orm";

import { env } from "@/env.mjs";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { appRouter } from "../../root";
import { adminProcedure } from "../../trpc";
import { replyToFeedback } from "./feedback.service";

import type { ProtectedTRPCContext } from "../../trpc";
import type { SendFeedbackReplyEmailInput } from "@/server/lib/notifications/feedback-reply";

const procedures = appRouter._def.procedures;
const adminGuard = adminProcedure._def.middlewares.at(-1);

describe("feedback.reply", () => {
  test("runs the admin guard", () => {
    expect(procedures["feedback.reply"]?._def.middlewares).toContain(adminGuard);
  });
});

// End to end against MySQL; see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("feedback replies (MySQL)", () => {
  const USER_ID = "feedback_reply_test_user";
  const ADMIN_ID = "feedback_reply_test_admin";
  const USER_EMAIL = "feedback-reply-user@example.com";
  let feedbackId = 0;

  function adminCtx() {
    // SAFETY: replyToFeedback only reads ctx.db; procedure guards are tested separately.
    return { db, auth: { userId: ADMIN_ID } } as ProtectedTRPCContext;
  }

  async function cleanup() {
    await db.delete(schema.feedback).where(eq(schema.feedback.userId, USER_ID));
    for (const id of [USER_ID, ADMIN_ID]) {
      await db.delete(schema.user).where(eq(schema.user.id, id));
    }
  }

  async function row() {
    const [item] = await db
      .select()
      .from(schema.feedback)
      .where(eq(schema.feedback.id, feedbackId));
    return item;
  }

  beforeAll(async () => {
    // Another test file replaces @/env.mjs with a partial object for the whole
    // run, dropping DATABASE_URL; the app's db client reads it on first use.
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
    await cleanup();
    await db.insert(schema.user).values([
      { id: USER_ID, email: USER_EMAIL, name: "Ama Mensah" },
      { id: ADMIN_ID, email: "feedback-reply-admin@example.com", isAdmin: true },
    ]);
  });

  beforeEach(async () => {
    await db.delete(schema.feedback).where(eq(schema.feedback.userId, USER_ID));
    const [inserted] = await db
      .insert(schema.feedback)
      .values({ userId: USER_ID, type: "question", message: "How do I export my links?" });
    feedbackId = Number(inserted.insertId);
  });

  afterAll(cleanup);

  test("a non-admin is refused and nothing changes", async () => {
    await expect(
      callProcedure({
        procedures,
        path: "feedback.reply",
        rawInput: { id: feedbackId, message: "Hi" },
        type: "mutation",
        ctx: { db, headers: new Headers(), auth: { userId: USER_ID } },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const item = await row();
    expect(item?.status).toBe("open");
    expect(item?.replyMessage).toBeNull();
  });

  test("emails the submitter, stores the reply and resolves the item", async () => {
    const sent: SendFeedbackReplyEmailInput[] = [];
    const { repliedAt } = await replyToFeedback(
      adminCtx(),
      { id: feedbackId, message: "Use the CSV export on the links page." },
      async (email) => {
        sent.push(email);
        return true;
      },
    );

    expect(sent).toEqual([
      {
        feedbackId,
        userId: USER_ID,
        toEmail: USER_EMAIL,
        toName: "Ama Mensah",
        reply: "Use the CSV export on the links page.",
        originalMessage: "How do I export my links?",
      },
    ]);
    const item = await row();
    expect(item?.status).toBe("resolved");
    expect(item?.replyMessage).toBe("Use the CSV export on the links page.");
    // MySQL timestamps drop milliseconds.
    expect(Math.abs(item!.repliedAt!.getTime() - repliedAt.getTime())).toBeLessThan(1000);
  });

  test("a failed send leaves the item open so it can be retried", async () => {
    await expect(
      replyToFeedback(adminCtx(), { id: feedbackId, message: "Hello" }, async () => false),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });

    const item = await row();
    expect(item?.status).toBe("open");
    expect(item?.repliedAt).toBeNull();
  });

  test("an item cannot be replied to twice", async () => {
    let sends = 0;
    const send = async () => {
      sends += 1;
      return true;
    };
    await replyToFeedback(adminCtx(), { id: feedbackId, message: "First" }, send);

    await expect(
      replyToFeedback(adminCtx(), { id: feedbackId, message: "Second" }, send),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(sends).toBe(1);
    expect((await row())?.replyMessage).toBe("First");
  });

  test("a missing item is NOT_FOUND", async () => {
    await expect(
      replyToFeedback(adminCtx(), { id: feedbackId + 1_000_000, message: "Hi" }, async () => true),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
