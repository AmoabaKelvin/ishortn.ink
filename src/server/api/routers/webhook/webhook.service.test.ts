import { describe, expect, test } from "bun:test";

import { TRPCError } from "@trpc/server";

import { db } from "@/server/db";

import { sendTestWebhook } from "./webhook.service";

import type { WorkspaceTRPCContext } from "../../trpc";

describe("sendTestWebhook", () => {
  test("refuses on a plan without webhooks before touching the endpoint", async () => {
    // SAFETY: the plan gate runs before any query; the service reads only workspace here.
    const ctx = {
      db,
      headers: new Headers(),
      auth: { userId: "webhook_test_free" },
      workspace: {
        type: "personal",
        userId: "webhook_test_free",
        teamId: null,
        teamSlug: null,
        role: "owner",
        plan: "free",
      },
    } as WorkspaceTRPCContext;

    const error = await sendTestWebhook(ctx, { id: 1 }).then(
      () => null,
      (err: Error) => err,
    );
    expect(error).toBeInstanceOf(TRPCError);
    expect(error).toMatchObject({
      code: "FORBIDDEN",
      message: "Webhooks are available on Pro and Ultra plans. Upgrade to add an endpoint.",
    });
  });
});
