import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { inArray } from "drizzle-orm";

import { env } from "@/env.mjs";
import { db } from "@/server/db";
import { webhook, webhookDelivery } from "@/server/db/schema";
import { toApiLink } from "@/server/lib/api-link";

import { dispatchWebhookEvents, runDueDeliveries, type DeliveryDeps } from "./delivery";
import { dbWebhookStore } from "./store";

// Runs against a disposable MySQL with the schema pushed (test/setup.ts points the app's db
// client at it); see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("dbWebhookStore (MySQL)", () => {
  const USERS = ["webhook_store_a", "webhook_store_b"];
  const TEAM_ID = 91036;
  const store = dbWebhookStore(db);
  const events = ["link.created", "link.deleted"] as const;
  const link = toApiLink({
    id: 1,
    createdAt: new Date(),
    domain: "isht.app",
    alias: "store-test",
    url: "https://example.com",
    disableLinkAfterDate: null,
    activateAt: null,
    disableLinkAfterClicks: null,
  });

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
  });

  async function clear() {
    const ids = (
      await db.select({ id: webhook.id }).from(webhook).where(inArray(webhook.userId, USERS))
    ).map((row) => row.id);
    if (ids.length > 0) {
      await db.delete(webhookDelivery).where(inArray(webhookDelivery.webhookId, ids));
      await db.delete(webhook).where(inArray(webhook.id, ids));
    }
  }

  async function addEndpoint(values: Partial<typeof webhook.$inferInsert> & { userId: string }) {
    const [result] = await db.insert(webhook).values({
      url: "https://hooks.example.com/in",
      events: [...events],
      secret: "whsec_test",
      ...values,
    });
    return Number(result.insertId);
  }

  function deps(status: number): DeliveryDeps & { disabled: number[] } {
    const disabled: number[] = [];
    return {
      disabled,
      now: () => new Date(),
      resolve: async () => ["93.184.216.34"],
      fetch: async () => new Response(null, { status }),
      onDisabled: async (id) => void disabled.push(id),
    };
  }

  beforeEach(clear);
  afterAll(clear);

  test("lists only the workspace's enabled endpoints", async () => {
    const personal = await addEndpoint({ userId: USERS[0]! });
    await addEndpoint({ userId: USERS[0]!, enabled: false });
    const teamEndpoint = await addEndpoint({ userId: USERS[1]!, teamId: TEAM_ID });
    await addEndpoint({ userId: USERS[1]! });

    const mine = await store.listEnabledEndpoints({ userId: USERS[0]!, teamId: null });
    // A team endpoint is the team's, whoever added it.
    const teams = await store.listEnabledEndpoints({ userId: USERS[0]!, teamId: TEAM_ID });

    expect(mine.map((e) => e.id)).toEqual([personal]);
    expect(teams.map((e) => e.id)).toEqual([teamEndpoint]);
    expect(mine[0]!.events).toEqual([...events]);
  });

  test("dispatch records one delivery per subscribed endpoint and saves the attempt", async () => {
    const a = await addEndpoint({ userId: USERS[0]! });
    const b = await addEndpoint({ userId: USERS[0]!, events: ["link.created"] });
    await addEndpoint({ userId: USERS[0]!, events: ["domain.verified"] });

    const jobs = await dispatchWebhookEvents(
      store,
      { userId: USERS[0]!, teamId: null },
      "link.created",
      [link],
      deps(200),
    );

    const rows = await db
      .select()
      .from(webhookDelivery)
      .where(inArray(webhookDelivery.webhookId, [a, b]));
    expect(jobs.map((job) => job.webhookId).sort()).toEqual([a, b].sort());
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.status === "succeeded" && row.attempts === 1)).toBe(true);
    expect(rows.every((row) => row.responseStatus === 200 && row.nextAttemptAt === null)).toBe(
      true,
    );
  });

  test("failures schedule a retry and disable the endpoint once, failing its queue", async () => {
    const id = await addEndpoint({ userId: USERS[0]!, consecutiveFailures: 18 });
    const failing = deps(500);
    const workspace = { userId: USERS[0]!, teamId: null };

    await dispatchWebhookEvents(store, workspace, "link.created", [link], failing);
    const [pending] = await db
      .select()
      .from(webhookDelivery)
      .where(inArray(webhookDelivery.webhookId, [id]));
    expect(pending).toMatchObject({ status: "pending", attempts: 1, error: "HTTP 500" });
    expect(pending!.nextAttemptAt).not.toBeNull();

    // Two failures racing for the 20th: only one disables and notifies.
    const [first, second] = await Promise.all([
      store.recordFailure(id, 20, new Date()),
      store.recordFailure(id, 20, new Date()),
    ]);
    expect([first, second].filter(Boolean)).toHaveLength(1);

    const [endpoint] = await db
      .select()
      .from(webhook)
      .where(inArray(webhook.id, [id]));
    expect(endpoint).toMatchObject({ enabled: false, consecutiveFailures: 21 });
    expect(endpoint!.disabledAt).not.toBeNull();
    const rows = await db
      .select()
      .from(webhookDelivery)
      .where(inArray(webhookDelivery.webhookId, [id]));
    expect(rows.map((row) => row.status)).toEqual(["failed"]);
    // The last error stays for the log and the email.
    expect(rows[0]!.error).toBe("HTTP 500");
    expect(await store.dueDeliveries(new Date(Date.now() + 86_400_000), 10)).toEqual([]);
  });

  test("due deliveries are picked up by the retry run", async () => {
    const id = await addEndpoint({ userId: USERS[0]! });
    await db.insert(webhookDelivery).values({
      webhookId: id,
      eventId: "evt_store_due",
      eventType: "link.created",
      payload: "{}",
      nextAttemptAt: new Date(Date.now() - 1000),
    });

    expect(await runDueDeliveries(store, deps(200))).toMatchObject({ succeeded: 1 });
    const [row] = await db
      .select()
      .from(webhookDelivery)
      .where(inArray(webhookDelivery.webhookId, [id]));
    expect(row).toMatchObject({ status: "succeeded", attempts: 1 });
  });
});
