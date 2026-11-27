import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { eq, inArray } from "drizzle-orm";

import { PLAN_VARIANT_IDS } from "@/lib/billing/plans";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { runLinkHealthCheck } from ".";

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
});
