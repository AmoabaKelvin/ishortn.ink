import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import crypto from "node:crypto";

import { TRPCError } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";

import { env } from "@/env.mjs";
import { PLAN_VARIANT_IDS } from "@/lib/billing/plans";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { parseScrapedPage } from "@/server/lib/metadata";
import { CREDENTIAL_FORM_REASON, LLM_CHECK_REASON, USER_MSG_UNSAFE } from "@/server/lib/phishing";
import { checkUrlWithLlmAfterResponse } from "@/server/lib/phishing/follow-up";
import { ServerTiming } from "@/server/lib/server-timing";

import { authenticateToken } from "../utils";
import { createTokenLink } from "./create";

import type { TokenLinkSafetyDeps } from "./create";

// Runs against a disposable MySQL with the schema pushed (test/setup.ts points
// the app's db client at it); see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("createTokenLink safety checks (MySQL)", () => {
  const USER_ID = "api_create_safety_test";
  const API_KEY = "api-create-safety-test-key";
  const URL_ = "https://studio-copyright-review.cfd/appeal";
  const PASS = { blocked: false, reason: "", userMessage: "" };

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
  });

  async function clear() {
    const links = await db
      .select({ id: schema.link.id })
      .from(schema.link)
      .where(eq(schema.link.userId, USER_ID));
    const ids = links.map((l) => l.id);
    if (ids.length > 0) {
      await db.delete(schema.flaggedLink).where(inArray(schema.flaggedLink.linkId, ids));
      await db
        .delete(schema.linkSafetyRecheck)
        .where(inArray(schema.linkSafetyRecheck.linkId, ids));
    }
    await db.delete(schema.subscription).where(eq(schema.subscription.userId, USER_ID));
    await db.delete(schema.link).where(eq(schema.link.userId, USER_ID));
    await db.delete(schema.token).where(eq(schema.token.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  }

  async function reset(plan: "free" | "pro") {
    await clear();
    await db.insert(schema.user).values({
      id: USER_ID,
      monthlyLinkCount: 0,
      lastLinkCountReset: new Date(),
      planCheckedAt: new Date(),
    });
    await db.insert(schema.token).values({
      userId: USER_ID,
      token: crypto.createHash("sha256").update(API_KEY).digest("hex"),
    });
    if (plan === "pro") {
      await db.insert(schema.subscription).values({
        userId: USER_ID,
        plan: "pro",
        variantId: PLAN_VARIANT_IDS.pro.monthly,
        status: "active",
      });
    }
  }

  /** Creates a link with fake safety layers and waits for the after-response check. */
  async function create(deps: TokenLinkSafetyDeps, url = URL_) {
    const auth = await authenticateToken(API_KEY, "api");
    if (!auth) throw new Error("token not found");
    let background: Promise<void> | undefined;
    const serverTiming = new ServerTiming();
    const created = await createTokenLink(auth.token, { url }, "api", serverTiming, {
      preChecks: mock(async () => PASS),
      readVerdict: mock(async () => false),
      rememberVerdict: mock(() => {}),
      scrape: mock(async (url: string) =>
        parseScrapedPage("<title>Copyright appeal</title>", url, 200, new Headers()),
      ),
      detect: mock(async (url: string) => ({ url, phishing: false })),
      checkAfterResponse: (...args) => {
        background = checkUrlWithLlmAfterResponse(...args);
        return background;
      },
      ...deps,
    });
    await background;
    const stored = await db.query.link.findFirst({ where: eq(schema.link.id, created.id) });
    const flags = await db
      .select()
      .from(schema.flaggedLink)
      .where(eq(schema.flaggedLink.linkId, created.id));
    const rechecks = await db
      .select()
      .from(schema.linkSafetyRecheck)
      .where(eq(schema.linkSafetyRecheck.linkId, created.id));
    return { created, stored, flags, rechecks, serverTiming };
  }

  const phishing = () => mock(async (url: string) => ({ url, phishing: true }));

  beforeEach(() => reset("free"));
  afterAll(clear);

  test("creates without waiting for the scrape or the LLM", async () => {
    const { created, serverTiming } = await create({});

    expect(created.url).toBe(URL_);
    const names = serverTiming
      .header()
      .split(", ")
      .map((metric) => metric.split(";")[0]);
    expect(names).toContain("safety");
    expect(names).not.toContain("scrape");
    expect(names).not.toContain("llm");
    expect(names).not.toContain("verdictcache");
  });

  test("blocks the link afterwards when the LLM flags it on a free account", async () => {
    const { stored, flags } = await create({ detect: phishing() });

    expect(stored?.blocked).toBe(true);
    expect(stored?.blockedReason).toBe(LLM_CHECK_REASON);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ reason: LLM_CHECK_REASON, status: "blocked" });
  });

  test("flags the link for review when the LLM flags it on a paying account", async () => {
    await reset("pro");

    const { stored, flags } = await create({ detect: phishing() });

    expect(stored?.blocked).toBeFalsy();
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ reason: LLM_CHECK_REASON, status: "pending" });
  });

  test.each([
    [
      "the LLM fails",
      {
        detect: mock(async () => {
          throw new Error("timeout");
        }),
      },
    ],
    [
      "the scrape fails",
      {
        scrape: mock(async () => {
          throw new Error("fetch failed");
        }),
      },
    ],
  ])("leaves the link live when %s", async (_name, deps) => {
    const { stored, flags, rechecks } = await create(deps);

    expect(stored?.blocked).toBeFalsy();
    expect(flags).toHaveLength(0);
    expect(rechecks.map((r) => r.reason)).toEqual("scrape" in deps ? ["scrape-failed"] : []);
  });

  test("blocks a credential form on a new free account and flags it on a paying one", async () => {
    const url = "https://spectrum-mail.framer.app/";
    const scrape = mock(async () =>
      parseScrapedPage(
        `<h1>Sign in to Webmail</h1><input type="email"><input type="password">`,
        url,
        200,
        new Headers(),
      ),
    );

    const free = await create({ scrape }, url);
    expect(free.stored?.blocked).toBe(true);
    expect(free.stored?.blockedReason).toBe(CREDENTIAL_FORM_REASON);

    await reset("pro");
    const paying = await create({ scrape }, url);
    expect(paying.stored?.blocked).toBeFalsy();
    expect(paying.flags).toMatchObject([{ reason: CREDENTIAL_FORM_REASON, status: "pending" }]);
  });

  test("queues a challenge page for a re-check and caches no verdict", async () => {
    const rememberVerdict = mock(() => {});
    const scrape = mock(async (url: string) =>
      parseScrapedPage("<title>Just a moment...</title>", url, 403, new Headers()),
    );

    const { stored, rechecks } = await create({ scrape, rememberVerdict });

    expect(stored?.blocked).toBeFalsy();
    expect(rechecks.map((r) => r.reason)).toEqual(["unverified-challenge"]);
    expect(rememberVerdict).not.toHaveBeenCalled();
  });

  test("rejects with 400 before any insert when a fast layer blocks", async () => {
    const auth = await authenticateToken(API_KEY, "api");
    if (!auth) throw new Error("token not found");
    const detect = phishing();

    const attempt = createTokenLink(auth.token, { url: URL_ }, "api", undefined, {
      preChecks: mock(async () => ({ blocked: true, reason: "sb", userMessage: USER_MSG_UNSAFE })),
      detect,
    });

    await expect(attempt).rejects.toThrow(
      new TRPCError({ code: "BAD_REQUEST", message: USER_MSG_UNSAFE }),
    );
    expect(detect).not.toHaveBeenCalled();
    const links = await db.select().from(schema.link).where(eq(schema.link.userId, USER_ID));
    expect(links).toHaveLength(0);
  });
});
