import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { inArray, like } from "drizzle-orm";

import { env } from "@/env.mjs";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { runLinkCreationHealthCheck } from "./health-check";

// Runs against a disposable MySQL with the schema pushed (test/setup.ts points
// the app's db client at it); see CONTRIBUTING.md, "Database tests". Rows are
// dated far in the future so other tests' rows fall outside the windows.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("runLinkCreationHealthCheck (MySQL)", () => {
  const NOW = new Date("2037-06-01T12:40:00Z");
  const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);
  const USER_IDS = ["health_1", "health_2", "health_3", "health_4", "health_5"];

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
  });

  async function clear() {
    await db.delete(schema.link).where(like(schema.link.alias, "health-%"));
    await db.delete(schema.user).where(inArray(schema.user.id, USER_IDS));
    await db.delete(schema.linkCreationFailure);
  }

  beforeEach(clear);
  afterAll(clear);

  test("flags signups without links and a server-side failure spike", async () => {
    await db
      .insert(schema.user)
      .values(
        USER_IDS.map((id) => ({ id, email: `${id}@example.com`, createdAt: minutesAgo(120) })),
      );
    await db.insert(schema.linkCreationFailure).values([
      ...Array.from({ length: 4 }, () => ({
        source: "dashboard" as const,
        step: "db" as const,
        code: "ECONNREFUSED",
        serverError: true,
        createdAt: minutesAgo(10),
      })),
      ...Array.from({ length: 6 }, () => ({
        source: "api" as const,
        step: "validation" as const,
        code: "CONFLICT",
        serverError: false,
        createdAt: minutesAgo(10),
      })),
      // Outside the retention window: pruned.
      {
        source: "bulk" as const,
        step: "safety" as const,
        code: "TIMEOUT",
        serverError: true,
        createdAt: minutesAgo(8 * 24 * 60),
      },
    ]);

    const result = await runLinkCreationHealthCheck(NOW);

    expect(result.alerts).toEqual(["failure-rate", "signups-without-links"]);
    expect(result.prunedFailures).toBe(1);
  });

  test("stays quiet once a new account creates a link", async () => {
    await db
      .insert(schema.user)
      .values(
        USER_IDS.map((id) => ({ id, email: `${id}@example.com`, createdAt: minutesAgo(120) })),
      );
    await db.insert(schema.link).values(
      Array.from({ length: 10 }, (_, i) => ({
        url: "https://example.com",
        alias: `health-${i}`,
        domain: "ishortn.ink",
        userId: "health_1",
        createdAt: minutesAgo(5),
      })),
    );
    await db.insert(schema.linkCreationFailure).values({
      source: "dashboard",
      step: "db",
      code: "ECONNREFUSED",
      serverError: true,
      createdAt: minutesAgo(5),
    });

    const result = await runLinkCreationHealthCheck(NOW);

    expect(result.alerts).toEqual([]);
  });
});
