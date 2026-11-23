import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { env } from "@/env.mjs";

import { GET } from "./route";

const SECRET = "upgrade-nudge-route-test-secret";
const saved = { CRON_SECRET: env.CRON_SECRET, EMAIL_FROM_LIFECYCLE: env.EMAIL_FROM_LIFECYCLE };

const call = (query = "", secret = SECRET) =>
  GET(
    new Request(`http://localhost/api/cron/upgrade-nudge${query}`, {
      headers: { Authorization: `Bearer ${secret}` },
    }),
  );

beforeAll(() => {
  Object.assign(env, { CRON_SECRET: SECRET, EMAIL_FROM_LIFECYCLE: undefined });
});

afterAll(() => {
  Object.assign(env, saved);
});

describe("GET /api/cron/upgrade-nudge", () => {
  test("rejects requests without the cron secret", async () => {
    expect((await call("", "wrong-secret-of-same-length-xxxxx")).status).toBe(401);
  });

  test("skips without sending when the lifecycle sender isn't configured", async () => {
    const response = await call();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      result: { skipped: "sender not configured" },
    });
  });
});

// The dry run reads the database; see CONTRIBUTING.md, "Database tests".
describe.skipIf(!process.env.TEST_DATABASE_URL)("GET /api/cron/upgrade-nudge dry run", () => {
  test("runs without the lifecycle sender and sends nothing", async () => {
    const response = await call("?dryRun=1");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.result).toMatchObject({ sent: 0, failed: 0 });
    expect(Array.isArray(body.result.previews)).toBe(true);
  });
});
