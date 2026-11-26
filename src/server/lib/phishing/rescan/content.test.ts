import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";

import { inArray } from "drizzle-orm";

import { env } from "@/env.mjs";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { parseScrapedPage } from "@/server/lib/metadata";

import { runPhishingRescan } from ".";
import { CONTENT_REASON } from "./content-utils";

import type { ContentCheckDeps } from "./content";

// Runs against a disposable MySQL with the schema pushed (test/setup.ts points
// the app's db client at it); see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const ago = (ms: number) => new Date(Date.now() - ms);

const CHALLENGE_HTML = `<!DOCTYPE html><html><head><title>Just a moment...</title></head>
<body><div id="cf-chl-widget-x"></div></body></html>`;
const LOGIN_HTML = `<!doctype html><html><head><title>My Site</title></head><body>
  <form action="/submit" method="post">
    <input type="email" name="email"><input type="password" name="pass">
  </form>
</body></html>`;

const page = (html: string, url: string) =>
  parseScrapedPage(html, url, 200, new Headers({ "content-type": "text/html" }));

/** Serves `html` for every URL and never calls the LLM. */
function serving(html: () => string) {
  const scrape = mock(async (url: string) => page(html(), url));
  const detect = mock(async (url: string) => ({ url, phishing: false }));
  return { scrape, detect } satisfies ContentCheckDeps;
}

describe.skipIf(!testDatabaseUrl)("phishing rescan content re-checks (MySQL)", () => {
  const NEW_FREE = "rescan_content_new_free";
  const OLD_FREE = "rescan_content_old_free";
  const NEW_PAID = "rescan_content_new_paid";
  const USERS = [NEW_FREE, OLD_FREE, NEW_PAID];
  const ids: Record<string, number> = {};

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
  });

  async function cleanup() {
    const links = await db
      .select({ id: schema.link.id })
      .from(schema.link)
      .where(inArray(schema.link.userId, USERS));
    const linkIds = links.map((l) => l.id);
    if (linkIds.length > 0) {
      await db.delete(schema.flaggedLink).where(inArray(schema.flaggedLink.linkId, linkIds));
      await db
        .delete(schema.linkSafetyRecheck)
        .where(inArray(schema.linkSafetyRecheck.linkId, linkIds));
    }
    await db.delete(schema.link).where(inArray(schema.link.userId, USERS));
    await db.delete(schema.subscription).where(inArray(schema.subscription.userId, USERS));
    await db.delete(schema.user).where(inArray(schema.user.id, USERS));
  }

  async function addLink(key: string, userId: string, url: string, age: number) {
    const [result] = await db.insert(schema.link).values({
      url,
      alias: `rescan-content-${key}`,
      domain: "isht.ink",
      userId,
      createdAt: ago(age),
    });
    ids[key] = result.insertId;
  }

  /** Backdates the link and its last check, as if time had passed. */
  async function ageLink(key: string, age: number, lastCheckedAge: number) {
    await db
      .update(schema.link)
      .set({ createdAt: ago(age) })
      .where(inArray(schema.link.id, [ids[key]!]));
    await db
      .update(schema.linkSafetyRecheck)
      .set({ lastCheckedAt: ago(lastCheckedAge) })
      .where(inArray(schema.linkSafetyRecheck.linkId, [ids[key]!]));
  }

  async function rows(key: string) {
    return db
      .select()
      .from(schema.linkSafetyRecheck)
      .where(inArray(schema.linkSafetyRecheck.linkId, [ids[key]!]));
  }

  async function linkOf(key: string) {
    const [row] = await db
      .select()
      .from(schema.link)
      .where(inArray(schema.link.id, [ids[key]!]));
    return row!;
  }

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values([
      { id: NEW_FREE, createdAt: ago(2 * DAY_MS) },
      { id: OLD_FREE, createdAt: ago(200 * DAY_MS) },
      { id: NEW_PAID, createdAt: ago(2 * DAY_MS) },
    ]);
    await db
      .insert(schema.subscription)
      .values({ userId: NEW_PAID, status: "active", plan: "pro" });
    await addLink("kit", NEW_FREE, "https://secure-login.weebly.com/verify", 40 * MINUTE_MS);
    await addLink("fresh", NEW_FREE, "https://other-login.weebly.com/", 10 * MINUTE_MS);
    await addLink("known", NEW_FREE, "https://github.com/acme", 40 * MINUTE_MS);
    await addLink("old", OLD_FREE, "https://old-login.weebly.com/", 40 * MINUTE_MS);
    await addLink("paid", NEW_PAID, "https://paid-login.weebly.com/", 40 * MINUTE_MS);
  });

  afterAll(cleanup);

  test("a challenge at 30 minutes, then a sign-in form at 24 hours, blocks the link", async () => {
    let html = CHALLENGE_HTML;
    const deps = serving(() => html);

    const first = await runPhishingRescan({ dryRun: false, backlogOnly: true, contentDeps: deps });
    expect(first.content).toEqual({ checked: 1, blocked: 0, flagged: 0, fetchErrors: 0 });
    expect(deps.scrape.mock.calls.map(([url]) => url)).toEqual([
      "https://secure-login.weebly.com/verify",
    ]);
    expect(await rows("kit")).toMatchObject([
      { reason: "new-account", checksDone: 1, result: "unverified" },
    ]);
    // Enrolled but not yet due; left out of the selection for good.
    expect(await rows("fresh")).toMatchObject([{ checksDone: 0, result: null }]);
    expect(await rows("known")).toMatchObject([{ checksDone: 2, result: "skipped" }]);
    expect(await rows("old")).toEqual([]);
    expect(await rows("paid")).toMatchObject([{ checksDone: 2, result: "skipped" }]);

    // Nothing new is due until the 24-hour mark, even once the run's claim has expired.
    html = LOGIN_HTML;
    await ageLink("kit", 2 * HOUR_MS, HOUR_MS);
    const again = await runPhishingRescan({ dryRun: false, backlogOnly: true, contentDeps: deps });
    expect(again.content.checked).toBe(0);

    await ageLink("kit", 25 * HOUR_MS, 24 * HOUR_MS);
    const second = await runPhishingRescan({ dryRun: false, backlogOnly: true, contentDeps: deps });
    expect(second.content).toEqual({ checked: 1, blocked: 1, flagged: 0, fetchErrors: 0 });
    expect(await linkOf("kit")).toMatchObject({ blocked: true, blockedReason: CONTENT_REASON });
    expect(await rows("kit")).toMatchObject([{ checksDone: 2, result: "phishing" }]);
  });

  test("links the creation check couldn't verify are flagged on paying accounts", async () => {
    await db.insert(schema.linkSafetyRecheck).values([
      { linkId: ids.paid!, reason: "unverified-challenge" },
      { linkId: ids.old!, reason: "scrape-failed" },
    ]);
    const deps = serving(() => LOGIN_HTML);

    const result = await runPhishingRescan({ dryRun: false, backlogOnly: true, contentDeps: deps });
    expect(result.content).toEqual({ checked: 3, blocked: 2, flagged: 1, fetchErrors: 0 });
    expect(await linkOf("old")).toMatchObject({ blocked: true });
    expect(await linkOf("paid")).toMatchObject({ blocked: false });

    const flags = await db
      .select()
      .from(schema.flaggedLink)
      .where(inArray(schema.flaggedLink.linkId, [ids.paid!]));
    expect(flags).toMatchObject([{ status: "pending", reason: CONTENT_REASON }]);
  });

  test("a dry run reports what would be blocked without writing", async () => {
    const deps = serving(() => LOGIN_HTML);

    const result = await runPhishingRescan({ dryRun: true, backlogOnly: true, contentDeps: deps });
    expect(result.content).toEqual({ checked: 1, blocked: 1, flagged: 0, fetchErrors: 0 });
    expect(result.decisions).toMatchObject([
      { linkId: ids.kit, action: "block", reason: CONTENT_REASON },
    ]);
    expect(await linkOf("kit")).toMatchObject({ blocked: false });
    expect(await rows("kit")).toEqual([]);
  });

  test("overlapping runs never fetch the same link twice", async () => {
    const deps = serving(() => CHALLENGE_HTML);
    const run = () => runPhishingRescan({ dryRun: false, backlogOnly: true, contentDeps: deps });

    const [a, b] = await Promise.all([run(), run()]);
    expect(a.content.checked + b.content.checked).toBe(1);
    expect(deps.scrape).toHaveBeenCalledTimes(1);
  });

  test("a failed fetch counts as the check and is reported", async () => {
    const deps = {
      scrape: mock(async () => {
        throw new Error("timeout");
      }),
    };

    const result = await runPhishingRescan({ dryRun: false, backlogOnly: true, contentDeps: deps });
    expect(result.content).toEqual({ checked: 1, blocked: 0, flagged: 0, fetchErrors: 1 });
    expect(await rows("kit")).toMatchObject([{ checksDone: 1, result: "error" }]);
  });
});
