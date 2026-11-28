import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { count, eq, inArray } from "drizzle-orm";

import { PLAN_VARIANT_IDS } from "@/lib/billing/plans";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { runLinkHealthCheck } from ".";
import { getDestinationDownByLinkId, resetLinkHealth } from "./status";

import type { SendLinkHealthAlertInput } from "@/server/lib/notifications/link-health";

// The fixture run from the task: one 200, one 404, one DNS failure and one 403 on a Pro account,
// checked on two consecutive days. See CONTRIBUTING.md, "Database tests".
describe.skipIf(!process.env.TEST_DATABASE_URL)("runLinkHealthCheck", () => {
  const PRO_USER = "user_linkhealth_pro_test";
  const FREE_USER = "user_linkhealth_free_test";
  const DAY_1 = new Date("2026-11-20T07:00:00Z");
  const DAY_2 = new Date("2026-11-21T07:00:00Z");
  const destinations = {
    ok: "https://fixture-ok.test/page",
    notFound: "https://fixture-404.test/page",
    dns: "https://fixture-dns.invalid/page",
    forbidden: "https://fixture-403.test/page",
    freeQr: "https://fixture-free-qr.test/menu",
    freeClicked: "https://fixture-free-clicked.test/page",
  };
  const linkIds = { ok: 0, notFound: 0, dns: 0, forbidden: 0, freeQr: 0, freeClicked: 0 };
  const fetched: string[] = [];

  const deps = {
    resolve: async (hostname: string) =>
      hostname === "fixture-dns.invalid" ? [] : ["93.184.216.34"],
    // SAFETY: the fake takes the (url, init) calls checkDestination makes; nothing else calls it.
    fetch: (async (input: string | URL | Request) => {
      const url = String(input);
      fetched.push(url);
      if (url === destinations.notFound) return new Response(null, { status: 404 });
      if (url === destinations.forbidden) return new Response(null, { status: 403 });
      // Links other database tests left behind count as up.
      return new Response(null, { status: 200 });
    }) as typeof fetch,
  };

  const cleanUp = async () => {
    const ids = (
      await db
        .select({ id: schema.link.id })
        .from(schema.link)
        .where(inArray(schema.link.userId, [PRO_USER, FREE_USER]))
    ).map((row) => row.id);
    if (ids.length) {
      await db.delete(schema.linkHealth).where(inArray(schema.linkHealth.linkId, ids));
      await db.delete(schema.linkVisit).where(inArray(schema.linkVisit.linkId, ids));
      await db.delete(schema.qrcode).where(inArray(schema.qrcode.linkId, ids));
      await db.delete(schema.link).where(inArray(schema.link.id, ids));
    }
    await db.delete(schema.subscription).where(eq(schema.subscription.userId, PRO_USER));
    await db.delete(schema.user).where(inArray(schema.user.id, [PRO_USER, FREE_USER]));
  };

  beforeAll(async () => {
    await cleanUp();
    await db.insert(schema.user).values([
      { id: PRO_USER, email: "linkhealth-pro@example.com", name: "Ama" },
      { id: FREE_USER, email: "linkhealth-free@example.com" },
    ]);
    await db.insert(schema.subscription).values({
      userId: PRO_USER,
      plan: "pro",
      status: "active",
      variantId: PLAN_VARIANT_IDS.pro.monthly,
    });
    for (const key of ["ok", "notFound", "dns", "forbidden", "freeQr", "freeClicked"] as const) {
      const [inserted] = await db.insert(schema.link).values({
        url: destinations[key],
        alias: `lh-${key}`.slice(0, 20),
        userId: key.startsWith("free") ? FREE_USER : PRO_USER,
      });
      linkIds[key] = inserted.insertId;
    }
    // Clicked the day before the first run; the free QR link only has its QR code.
    await db.insert(schema.linkVisit).values(
      (["ok", "notFound", "dns", "forbidden", "freeClicked"] as const).map((key) => ({
        linkId: linkIds[key],
        createdAt: new Date(DAY_1.getTime() - 24 * 60 * 60 * 1000),
      })),
    );
    await db.insert(schema.qrcode).values({
      userId: FREE_USER,
      linkId: linkIds.freeQr,
      contentType: "link",
      content: "https://ishortn.ink/lh-freeQr",
      patternStyle: "square",
      cornerStyle: "square",
      color: "#000000",
    });
  });

  afterAll(cleanUp);

  const healthOf = async () => {
    const rows = await db
      .select()
      .from(schema.linkHealth)
      .where(inArray(schema.linkHealth.linkId, Object.values(linkIds)));
    const byId = new Map(rows.map((row) => [row.linkId, row]));
    return Object.fromEntries(
      Object.entries(linkIds).map(([key, id]) => [key, byId.get(id) ?? null]),
    );
  };

  test("records health over two daily runs and sends one email for the two broken links", async () => {
    const sent: SendLinkHealthAlertInput[] = [];
    const send = async (input: SendLinkHealthAlertInput) => {
      sent.push(input);
      return true;
    };
    const ours = () => sent.filter((email) => [PRO_USER, FREE_USER].includes(email.userId));

    await runLinkHealthCheck({ now: DAY_1, deps, send, sendIntervalMs: 0 });
    let health = await healthOf();
    expect(health.ok).toMatchObject({ lastStatus: 200, consecutiveFailures: 0, brokenSince: null });
    expect(health.notFound).toMatchObject({ lastStatus: 404, consecutiveFailures: 1 });
    expect(health.notFound?.brokenSince).toBeNull();
    expect(health.dns).toMatchObject({
      lastStatus: null,
      lastError: "dns_failure",
      consecutiveFailures: 1,
      brokenSince: null,
    });
    expect(health.forbidden).toMatchObject({ lastStatus: null, consecutiveFailures: 0 });
    expect(health.freeQr).toMatchObject({ lastStatus: 200 });
    // Free links without a QR code are not checked.
    expect(health.freeClicked).toBeNull();
    expect(fetched).not.toContain(destinations.freeClicked);
    expect(ours()).toHaveLength(0);

    // A rerun the same day finds nothing due.
    await runLinkHealthCheck({ now: new Date(DAY_1.getTime() + 60_000), deps, send });
    expect((await healthOf()).notFound?.consecutiveFailures).toBe(1);

    await runLinkHealthCheck({ now: DAY_2, deps, send, sendIntervalMs: 0 });
    health = await healthOf();
    expect(health.notFound).toMatchObject({ consecutiveFailures: 2, brokenSince: DAY_2 });
    expect(health.dns).toMatchObject({ consecutiveFailures: 2, brokenSince: DAY_2 });
    expect(health.forbidden).toMatchObject({ consecutiveFailures: 0, brokenSince: null });
    expect(health.ok?.brokenSince).toBeNull();

    expect(ours()).toHaveLength(1);
    const [email] = ours();
    expect(email!.userId).toBe(PRO_USER);
    expect(email!.email).toBe("linkhealth-pro@example.com");
    expect(
      email!.links.map((item) => [item.destination, item.problem, item.clicksLast7Days]),
    ).toEqual([
      [destinations.notFound, "404 Not Found", 1],
      [destinations.dns, "DNS lookup failed", 1],
    ]);
    expect(email!.links.every((item) => !item.onQrCode)).toBe(true);
    expect(health.notFound?.alertedAt).toEqual(DAY_2);
    expect(health.dns?.alertedAt).toEqual(DAY_2);

    // Still down the next day: no second alert.
    await runLinkHealthCheck({
      now: new Date(DAY_2.getTime() + 24 * 60 * 60 * 1000),
      deps,
      send,
      sendIntervalMs: 0,
    });
    expect(ours()).toHaveLength(1);
  });

  test("the badge shows only on live links, and a reset clears it", async () => {
    const ids = [linkIds.notFound, linkIds.dns];
    expect([...(await getDestinationDownByLinkId(db, "pro", ids)).keys()].sort()).toEqual(
      [...ids].sort(),
    );
    expect((await getDestinationDownByLinkId(db, "free", ids)).size).toBe(0);

    await db.update(schema.link).set({ archived: true }).where(eq(schema.link.id, linkIds.dns));
    expect([...(await getDestinationDownByLinkId(db, "pro", ids)).keys()]).toEqual([
      linkIds.notFound,
    ]);
    await db.update(schema.link).set({ archived: false }).where(eq(schema.link.id, linkIds.dns));

    await resetLinkHealth(db, linkIds.notFound);
    expect((await healthOf()).notFound).toBeNull();
    expect([...(await getDestinationDownByLinkId(db, "pro", ids)).keys()]).toEqual([linkIds.dns]);
  });

  test("a run removes health rows of deleted links", async () => {
    await db.insert(schema.linkHealth).values({
      linkId: 2_000_000_000,
      lastCheckedAt: DAY_1,
      consecutiveFailures: 1,
    });
    await runLinkHealthCheck({ now: DAY_2, deps, send: async () => true, sendIntervalMs: 0 });
    const left = await db
      .select()
      .from(schema.linkHealth)
      .where(eq(schema.linkHealth.linkId, 2_000_000_000));
    expect(left).toHaveLength(0);
  });
});

// A large synthetic candidate set: each batch is written before the next is loaded, so a run
// holds at most one batch of links, and overlapping runs never alert a link twice.
describe.skipIf(!process.env.TEST_DATABASE_URL)("runLinkHealthCheck at scale", () => {
  const BULK_USER = "user_linkhealth_bulk_test";
  const OVERLAP_USER = "user_linkhealth_overlap_test";
  const LINKS = 1_000;
  const BATCH = 100;
  const DAY_1 = new Date("2026-12-01T07:00:00Z");
  const DAY_2 = new Date("2026-12-02T07:00:00Z");
  const DAY_3 = new Date("2026-12-03T07:00:00Z");
  const bulkUrl = (i: number) => `https://fixture-bulk.test/${i}`;
  let bulkIds: number[] = [];
  let overlapIds: number[] = [];

  const resolve = async () => ["93.184.216.34"];
  const fakeFetch = (statusOf: (url: string) => Promise<number> | number) =>
    // SAFETY: the fake takes the (url, init) calls checkDestination makes; nothing else calls it.
    (async (input: string | URL | Request) =>
      new Response(null, { status: await statusOf(String(input)) })) as typeof fetch;
  const cleanUp = async () => {
    const ids = (
      await db
        .select({ id: schema.link.id })
        .from(schema.link)
        .where(inArray(schema.link.userId, [BULK_USER, OVERLAP_USER]))
    ).map((row) => row.id);
    if (ids.length) {
      await db.delete(schema.linkHealth).where(inArray(schema.linkHealth.linkId, ids));
      await db.delete(schema.link).where(inArray(schema.link.id, ids));
    }
    await db.delete(schema.subscription).where(eq(schema.subscription.userId, OVERLAP_USER));
    await db.delete(schema.user).where(inArray(schema.user.id, [BULK_USER, OVERLAP_USER]));
  };

  beforeAll(async () => {
    await cleanUp();
    await db.insert(schema.user).values([
      { id: BULK_USER, email: "linkhealth-bulk@example.com" },
      { id: OVERLAP_USER, email: "linkhealth-overlap@example.com" },
    ]);
    await db.insert(schema.subscription).values({
      userId: OVERLAP_USER,
      plan: "pro",
      status: "active",
      variantId: PLAN_VARIANT_IDS.pro.monthly,
    });
    // QR-code links are checked on every plan without needing click rows.
    await db.insert(schema.link).values(
      Array.from({ length: LINKS }, (_, i) => ({
        url: bulkUrl(i),
        alias: `lh-bulk-${i}`,
        userId: BULK_USER,
        isQrCode: true,
      })),
    );
    await db.insert(schema.link).values(
      Array.from({ length: 3 }, (_, i) => ({
        url: `https://fixture-overlap.test/${i}`,
        alias: `lh-overlap-${i}`,
        userId: OVERLAP_USER,
        isQrCode: true,
      })),
    );
    const idsOf = async (userId: string) =>
      (
        await db
          .select({ id: schema.link.id })
          .from(schema.link)
          .where(eq(schema.link.userId, userId))
          .orderBy(schema.link.id)
      ).map((row) => row.id);
    bulkIds = await idsOf(BULK_USER);
    overlapIds = await idsOf(OVERLAP_USER);
  });

  afterAll(cleanUp);

  const writtenBulk = async () => {
    const [row] = await db
      .select({ n: count() })
      .from(schema.linkHealth)
      .where(inArray(schema.linkHealth.linkId, bulkIds));
    return row!.n;
  };

  test("checks a large candidate set one batch at a time, writing each batch first", async () => {
    // Batch k's first fetch records how many links earlier batches had written by then.
    const writtenBefore = new Map<number, number>();
    const fetch = fakeFetch(async (url) => {
      const match = /fixture-bulk\.test\/(\d+)$/.exec(url);
      if (match) {
        const batch = Math.floor(Number(match[1]) / BATCH);
        if (!writtenBefore.has(batch)) {
          writtenBefore.set(batch, -1);
          writtenBefore.set(batch, await writtenBulk());
        }
      }
      return 200;
    });

    // Other tests' links may also be due; the bulk links are the newest, so they come last.
    const result = await runLinkHealthCheck({
      now: DAY_1,
      deps: { resolve, fetch },
      send: async () => true,
      sendIntervalMs: 0,
      maxLinks: 100_000,
      batchSize: BATCH,
    });

    expect(result.checked).toBeGreaterThanOrEqual(LINKS);
    expect(await writtenBulk()).toBe(LINKS);
    expect([...writtenBefore.keys()].sort((a, b) => a - b)).toEqual(
      Array.from({ length: LINKS / BATCH }, (_, i) => i),
    );
    for (const [batch, written] of writtenBefore) expect(written).toBe(batch * BATCH);
  });

  test("a dry run over the same set writes nothing", async () => {
    const before = await db
      .select()
      .from(schema.linkHealth)
      .where(inArray(schema.linkHealth.linkId, bulkIds.slice(0, 5)));
    const result = await runLinkHealthCheck({
      now: DAY_2,
      deps: { resolve, fetch: fakeFetch(() => 404) },
      maxLinks: 100_000,
      batchSize: BATCH,
      dryRun: true,
    });
    expect(result.alerts).toBeNull();
    expect(result.previews?.filter((row) => bulkIds.includes(row.linkId))).toHaveLength(LINKS);
    const after = await db
      .select()
      .from(schema.linkHealth)
      .where(inArray(schema.linkHealth.linkId, bulkIds.slice(0, 5)));
    expect(after).toEqual(before);
  });

  test("overlapping runs record one failure per day and send one email", async () => {
    // The first test checked every link on DAY_1; from DAY_2 only the overlap user's links fail.
    const fetch = fakeFetch((url) => (url.includes("fixture-overlap.test") ? 404 : 200));
    const sent: SendLinkHealthAlertInput[] = [];
    const send = async (input: SendLinkHealthAlertInput) => {
      if (input.userId === OVERLAP_USER) sent.push(input);
      return true;
    };
    const run = (now: Date) =>
      runLinkHealthCheck({
        now,
        deps: { resolve, fetch },
        send,
        sendIntervalMs: 0,
        maxLinks: 100_000,
      });

    await Promise.all([run(DAY_2), run(new Date(DAY_2.getTime() + 1_000))]);
    await Promise.all([run(DAY_3), run(new Date(DAY_3.getTime() + 1_000))]);
    // A retry an hour later finds nothing due and nothing to alert.
    await run(new Date(DAY_3.getTime() + 60 * 60 * 1000));

    const health = await db
      .select()
      .from(schema.linkHealth)
      .where(inArray(schema.linkHealth.linkId, overlapIds));
    expect(health.map((row) => row.consecutiveFailures)).toEqual([2, 2, 2]);
    expect(health.every((row) => row.alertedAt !== null)).toBe(true);
    expect(sent.flatMap((email) => email.links.map((item) => item.destination)).sort()).toEqual(
      overlapIds.map((_, i) => `https://fixture-overlap.test/${i}`),
    );
  });
});
