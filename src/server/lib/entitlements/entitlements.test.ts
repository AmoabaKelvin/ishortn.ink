import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import crypto from "node:crypto";

import { eq, inArray } from "drizzle-orm";

import { POST as createApiLink } from "@/app/api/v1/links/route";
import { env } from "@/env.mjs";
import { planAtLeast } from "@/lib/billing/entitlements";
import { getPlanCaps } from "@/lib/billing/plans";
import { DEFAULT_PLATFORM_DOMAIN } from "@/lib/constants/domains";
import { appRouter } from "@/server/api/root";
import { createBioPage } from "@/server/api/routers/bio-page/bio-page.service";
import { addDomainToUserAccount } from "@/server/api/routers/domains/domains.service";
import { createFolder } from "@/server/api/routers/folder/folder.service";
import { reorderGeoRules, updateGeoRule } from "@/server/api/routers/geo-rules/geo-rules.service";
import { linkRouter } from "@/server/api/routers/link/link.procedure";
import {
  bulkCreateLinks,
  createLink,
  shortenLinkWithAutoAlias,
  updateLink,
} from "@/server/api/routers/link/link.service";
import { createToken } from "@/server/api/routers/token/token.service";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { prepareHiddenTrackingLink } from "@/server/lib/tracking-link";
import { getUserPlanContext } from "@/server/lib/user-plan";
import { resolveWorkspaceContext, workspaceUsagePlan } from "@/server/lib/workspace";
import { userHasUltraPlan } from "@/server/lib/workspace/workspace.service";

import { reconcileEntitlements, syncEntitlementsAfterBillingEvent } from "./grace";

import type { Plan } from "@/lib/billing/plans";
import type { CreateLinkInput } from "@/server/api/routers/link/link.input";
import type { TRPCContext, WorkspaceTRPCContext } from "@/server/api/trpc";

// Plan entitlements on every link write path (dashboard tRPC, /api/v1, CSV
// import) against a real MySQL. Set TEST_DATABASE_URL to run them; see
// CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

// Each test runs real queries; some take several round trips.
setDefaultTimeout(20_000);

const DAY = 24 * 60 * 60 * 1000;
const PRO_VARIANT = 1811616;
const ULTRA_VARIANT = 1108002;
// localhost is refused by the metadata scraper, so the URL safety check fails
// open without any network call.
const TARGET_URL = "http://localhost/entitlements-test";

type Account = {
  id: string;
  subscription?: { status: string; variantId: number; endsAt?: Date };
  grace?: { plan: "pro" | "ultra"; endsAt: Date };
  domains: number;
};

// "lapsed" accounts are a Pro subscription that expired; the webhook started a
// grace period that is still running (inGrace) or has passed (afterGrace).
const ACCOUNTS = {
  free: { id: "ent_test_free", domains: 3 },
  pro: {
    id: "ent_test_pro",
    subscription: { status: "active", variantId: PRO_VARIANT },
    domains: 3,
  },
  proFiveDomains: {
    id: "ent_test_pro5",
    subscription: { status: "active", variantId: PRO_VARIANT },
    domains: 5,
  },
  ultra: {
    id: "ent_test_ultra",
    subscription: { status: "active", variantId: ULTRA_VARIANT },
    domains: 3,
  },
  lapsedInGrace: {
    id: "ent_test_lapsed_in",
    subscription: { status: "expired", variantId: PRO_VARIANT },
    grace: { plan: "pro", endsAt: new Date(Date.now() + 3 * DAY) },
    domains: 3,
  },
  lapsedAfterGrace: {
    id: "ent_test_lapsed_after",
    subscription: { status: "expired", variantId: PRO_VARIANT },
    grace: { plan: "pro", endsAt: new Date(Date.now() - DAY) },
    domains: 3,
  },
} satisfies Record<string, Account>;

type AccountKey = keyof typeof ACCOUNTS;
const ACCOUNT_KEYS: AccountKey[] = [
  "free",
  "pro",
  "proFiveDomains",
  "ultra",
  "lapsedInGrace",
  "lapsedAfterGrace",
];
// The plan each account is entitled to right now.
const ACCOUNT_PLAN = {
  free: "free",
  pro: "pro",
  proFiveDomains: "pro",
  ultra: "ultra",
  lapsedInGrace: "pro",
  lapsedAfterGrace: "free",
} satisfies Record<AccountKey, Plan>;
// Accounts set up by individual tests below.
const UNCHECKED_OVER_ID = "ent_test_unchecked_over";
const UNCHECKED_FREE_ID = "ent_test_unchecked_free";
const OVER_PLAN_GRACE_ID = "ent_test_over_plan_grace";
const PAST_DUE_ID = "ent_test_past_due";
const USER_IDS = [
  ...Object.values(ACCOUNTS).map((account) => account.id),
  UNCHECKED_OVER_ID,
  UNCHECKED_FREE_ID,
  OVER_PLAN_GRACE_ID,
  PAST_DUE_ID,
];
const TEAM_SLUGS = ["ent-test-pro-team", "ent-test-ultra-team"];

const domainOf = (key: AccountKey, n: number) =>
  `d${n}.${ACCOUNTS[key].id.replaceAll("_", "-")}.test`;

describe.skipIf(!testDatabaseUrl)("plan entitlements on write paths (MySQL)", () => {
  async function cleanup() {
    const teams = await db.query.team.findMany({ where: inArray(schema.team.slug, TEAM_SLUGS) });
    const teamIds = teams.map((row) => row.id);
    if (teamIds.length > 0) {
      await db.delete(schema.link).where(inArray(schema.link.teamId, teamIds));
      await db.delete(schema.teamMember).where(inArray(schema.teamMember.teamId, teamIds));
      await db.delete(schema.team).where(inArray(schema.team.id, teamIds));
    }
    await db
      .delete(schema.geoRule)
      .where(
        inArray(
          schema.geoRule.linkId,
          db
            .select({ id: schema.link.id })
            .from(schema.link)
            .where(inArray(schema.link.userId, USER_IDS)),
        ),
      );
    await db.delete(schema.link).where(inArray(schema.link.userId, USER_IDS));
    await db.delete(schema.folder).where(inArray(schema.folder.userId, USER_IDS));
    await db.delete(schema.siteSettings).where(inArray(schema.siteSettings.userId, USER_IDS));
    await db.delete(schema.bioPage).where(inArray(schema.bioPage.userId, USER_IDS));
    await db.delete(schema.customDomain).where(inArray(schema.customDomain.userId, USER_IDS));
    await db.delete(schema.token).where(inArray(schema.token.userId, USER_IDS));
    await db.delete(schema.subscription).where(inArray(schema.subscription.userId, USER_IDS));
    await db.delete(schema.user).where(inArray(schema.user.id, USER_IDS));
  }

  beforeAll(async () => {
    // Another test file replaces @/env.mjs with a partial object for the whole
    // run, dropping DATABASE_URL; the app's db client reads it on first use.
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
    stubCloudflareContext();
    await cleanup();

    for (const key of ACCOUNT_KEYS) {
      const account: Account = ACCOUNTS[key];
      await db.insert(schema.user).values({
        id: account.id,
        email: `${account.id}@entitlements.test`,
        lastLinkCountReset: new Date(),
        // Checked already, so the restrictions apply as they will after the first reconcile.
        planCheckedAt: new Date(),
        planGracePlan: account.grace?.plan ?? null,
        planGraceEndsAt: account.grace?.endsAt ?? null,
        planGraceReason: account.grace ? "lapsed" : null,
        // Emails for these graces count as sent, so the reconcile below sends none.
        planGraceEmailStage: account.grace ? 3 : 0,
      });
      if (account.subscription) {
        await db.insert(schema.subscription).values({
          userId: account.id,
          subscriptionId: 1,
          status: account.subscription.status,
          variantId: account.subscription.variantId,
          plan: account.subscription.variantId === ULTRA_VARIANT ? "ultra" : "pro",
        });
      }
      await db.insert(schema.token).values({
        userId: account.id,
        token: crypto.createHash("sha256").update(apiKey(key)).digest("hex"),
      });
      // Oldest first: d1 was added a week before d2, and so on.
      for (let n = 1; n <= account.domains; n++) {
        await db.insert(schema.customDomain).values({
          domain: domainOf(key, n),
          userId: account.id,
          status: "active",
          createdAt: new Date(Date.now() - (10 - n) * 7 * DAY),
        });
      }
    }
  }, 60_000);

  afterAll(cleanup);

  const apiKey = (key: AccountKey) => `entitlements-test-${key}`;

  async function workspaceCtx(key: AccountKey, host = "ishortn.ink") {
    const userId = ACCOUNTS[key].id;
    const workspace = await resolveWorkspaceContext(userId, host, db);
    // SAFETY: the link services read ctx.db, ctx.auth.userId, ctx.headers and ctx.workspace.
    return {
      db,
      auth: { userId },
      headers: new Headers({ host }),
      workspace,
    } as WorkspaceTRPCContext;
  }

  let aliasCounter = 0;
  const uniqueAlias = () => `entt${Date.now().toString(36)}${aliasCounter++}`;

  async function dashboardCreate(key: AccountKey, input: Partial<CreateLinkInput>) {
    const ctx = await workspaceCtx(key);
    try {
      await createLink(ctx, { url: TARGET_URL, alias: uniqueAlias(), ...input });
      return "ok";
    } catch (error) {
      return error instanceof Error ? error.message : "error";
    }
  }

  type ApiBody = {
    alias?: string;
    domain?: string;
    password?: string;
    activatesAt?: string;
    utmParams?: { utm_source: string };
  };

  async function apiCreate(key: AccountKey, body: ApiBody) {
    const response = await createApiLink(
      new Request("http://localhost/api/v1/links", {
        method: "POST",
        headers: { "x-api-key": apiKey(key), "content-type": "application/json" },
        body: JSON.stringify({ url: TARGET_URL, alias: uniqueAlias(), ...body }),
      }),
    );
    return response.status;
  }

  async function csvCreate(key: AccountKey, rows: { alias?: string; domain?: string }[]) {
    const ctx = await workspaceCtx(key);
    const csv = [
      "url,alias,domain",
      ...rows.map((row) => `${TARGET_URL},${row.alias ?? uniqueAlias()},${row.domain ?? ""}`),
    ].join("\n");
    return bulkCreateLinks(ctx, csv, async () => {});
  }

  // ---------------------------------------------------------------------------
  // Custom domains
  // ---------------------------------------------------------------------------

  // Which of each account's custom domains (by age, oldest first) take new links.
  const DOMAIN_MATRIX: [AccountKey, boolean[]][] = [
    ["free", [false, false, false]],
    ["pro", [true, true, true]],
    ["proFiveDomains", [true, true, true, false, false]],
    ["ultra", [true, true, true]],
    ["lapsedInGrace", [true, true, true]],
    ["lapsedAfterGrace", [false, false, false]],
  ];

  describe.each(DOMAIN_MATRIX)("%s custom domains", (key, usable) => {
    test.each(usable.map((allowed, i) => [i + 1, allowed] as const))(
      "dashboard: domain %i takes new links: %p",
      async (n, allowed) => {
        const result = await dashboardCreate(key, { domain: domainOf(key, n) });
        expect(result === "ok").toBe(allowed);
      },
    );

    test.each(usable.map((allowed, i) => [i + 1, allowed] as const))(
      "API: domain %i takes new links: %p",
      async (n, allowed) => {
        expect(await apiCreate(key, { domain: domainOf(key, n) })).toBe(allowed ? 201 : 403);
      },
    );

    test("CSV: only usable domains take rows", async () => {
      const result = await csvCreate(
        key,
        usable.map((_, i) => ({ domain: domainOf(key, i + 1) })),
      );
      // Failures report the file line; line 1 is the header.
      expect(result.failures.map((failure) => failure.row)).toEqual(
        usable.flatMap((allowed, i) => (allowed ? [] : [i + 2])),
      );
    });
  });

  test("a lapsed Pro account past grace can't edit links on its custom domains", async () => {
    const [link] = await db.insert(schema.link).values({
      url: TARGET_URL,
      alias: uniqueAlias(),
      domain: domainOf("lapsedAfterGrace", 2),
      userId: ACCOUNTS.lapsedAfterGrace.id,
      passwordHash: "existing",
    });
    const ctx = await workspaceCtx("lapsedAfterGrace");
    expect(
      updateLink(ctx, { id: Number(link.insertId), url: `${TARGET_URL}/new` }),
    ).rejects.toThrow(/Custom domains are available on Pro and Ultra/);
  });

  test("links on a custom domain within the plan stay editable while it isn't verified", async () => {
    const domain = domainOf("pro", 1);
    const where = eq(schema.customDomain.domain, domain);
    const [link] = await db.insert(schema.link).values({
      url: TARGET_URL,
      alias: uniqueAlias(),
      domain,
      userId: ACCOUNTS.pro.id,
    });
    await db.update(schema.customDomain).set({ status: "pending" }).where(where);
    try {
      const ctx = await workspaceCtx("pro");
      await updateLink(ctx, { id: Number(link.insertId), url: `${TARGET_URL}/pending` });
      // New links still need a verified domain.
      expect(await dashboardCreate("pro", { domain })).toMatch(/not available/);
    } finally {
      await db.update(schema.customDomain).set({ status: "active" }).where(where);
    }
  });

  // ---------------------------------------------------------------------------
  // Paid workspace features
  // ---------------------------------------------------------------------------

  // Whether each account can create its first folder and its second bio page.
  test.each(ACCOUNT_KEYS.map((key) => [key] as const))(
    "dashboard: %s folders and bio pages follow the plan",
    async (key) => {
      const ctx = await workspaceCtx(key);
      const paid = ACCOUNT_PLAN[key] !== "free";
      const folder = await createFolder(ctx, { name: `Folder ${uniqueAlias()}` })
        .then(() => "ok")
        .catch((error: Error) => error.message);
      expect(folder === "ok").toBe(paid);

      for (const n of [1, 2]) {
        const slug = `${uniqueAlias()}-${n}`;
        const page = await createBioPage(ctx, { slug })
          .then(() => "ok")
          .catch((error: Error) => error.message);
        expect(page === "ok").toBe(n === 1 || paid);
      }
    },
  );

  // ---------------------------------------------------------------------------
  // Accounts not checked yet (enforcement ships)
  // ---------------------------------------------------------------------------

  test("an unchecked account over its plan gets its grace on the first request", async () => {
    await db.insert(schema.user).values({ id: UNCHECKED_OVER_ID, lastLinkCountReset: new Date() });
    const domains = [1, 2].map((n) => `d${n}.ent-test-unchecked.test`);
    for (const [i, domain] of domains.entries()) {
      await db.insert(schema.customDomain).values({
        domain,
        userId: UNCHECKED_OVER_ID,
        status: "active",
        createdAt: new Date(Date.now() - (2 - i) * DAY),
      });
    }

    const workspace = await resolveWorkspaceContext(UNCHECKED_OVER_ID, "ishortn.ink", db);
    expect(workspace.plan).toBe("free");
    expect(workspaceUsagePlan(workspace)).toBe("pro");
    const row = await db.query.user.findFirst({ where: eq(schema.user.id, UNCHECKED_OVER_ID) });
    expect(row?.planGraceReason).toBe("over_plan");
    expect(row?.planCheckedAt).not.toBeNull();
    expect(row?.planGraceEndsAt?.getTime()).toBeGreaterThan(Date.now() + 6.9 * DAY);

    // Its domains keep taking links through the grace period.
    const [link] = await db.insert(schema.link).values({
      url: TARGET_URL,
      alias: uniqueAlias(),
      domain: domains[1]!,
      userId: UNCHECKED_OVER_ID,
    });
    // SAFETY: updateLink reads ctx.db, ctx.auth.userId, ctx.headers and ctx.workspace.
    const ctx = {
      db,
      auth: { userId: UNCHECKED_OVER_ID },
      headers: new Headers({ host: "ishortn.ink" }),
      workspace,
    } as WorkspaceTRPCContext;
    await updateLink(ctx, { id: Number(link.insertId), url: `${TARGET_URL}/unchecked` });
  });

  test("an unchecked account within its plan is only marked as checked", async () => {
    await db.insert(schema.user).values({ id: UNCHECKED_FREE_ID, lastLinkCountReset: new Date() });
    const workspace = await resolveWorkspaceContext(UNCHECKED_FREE_ID, "ishortn.ink", db);
    expect(workspace.plan).toBe("free");
    const row = await db.query.user.findFirst({ where: eq(schema.user.id, UNCHECKED_FREE_ID) });
    expect(row?.planGraceEndsAt).toBeNull();
    expect(row?.planCheckedAt).not.toBeNull();
  });

  test("an over-plan grace doesn't unlock team creation", async () => {
    await db.insert(schema.user).values({
      id: OVER_PLAN_GRACE_ID,
      planCheckedAt: new Date(),
      planGracePlan: "ultra",
      planGraceEndsAt: new Date(Date.now() + 3 * DAY),
      planGraceReason: "over_plan",
    });
    expect(await userHasUltraPlan(OVER_PLAN_GRACE_ID, db)).toBe(false);
    expect(await userHasUltraPlan(ACCOUNTS.ultra.id, db)).toBe(true);
  });

  test("an over-plan grace keeps existing usage but grows nothing", async () => {
    // Created by the test above: a free account in an over-plan grace at Ultra.
    const workspace = await resolveWorkspaceContext(OVER_PLAN_GRACE_ID, "ishortn.ink", db);
    expect(workspace.plan).toBe("free");
    expect(workspaceUsagePlan(workspace)).toBe("ultra");
    // SAFETY: these services read ctx.db, ctx.auth.userId and ctx.workspace.
    const ctx = {
      db,
      auth: { userId: OVER_PLAN_GRACE_ID },
      headers: new Headers({ host: "ishortn.ink" }),
      workspace,
    } as WorkspaceTRPCContext;

    const planCtx = await getUserPlanContext(OVER_PLAN_GRACE_ID, db);
    expect(planCtx?.linksLimit).toBe(getPlanCaps("free").linksLimit);
    expect(createToken(ctx, { name: "key" })).rejects.toThrow(/API access is a Pro feature/);
    expect(addDomainToUserAccount(ctx, { domain: "new.over-plan.test" })).rejects.toThrow(
      /active subscription/,
    );

    // New links can't pick up paid features the grace plan covers.
    for (const input of [
      { cloaking: true },
      { utmParams: { utm_source: "new" } },
      { password: "hunter22" },
      { activateAt: new Date(Date.now() + DAY) },
    ] satisfies Partial<CreateLinkInput>[]) {
      expect(
        createLink(ctx, { url: TARGET_URL, alias: uniqueAlias(), ...input }),
      ).rejects.toThrow();
    }
    expect(createFolder(ctx, { name: `Folder ${uniqueAlias()}` })).rejects.toThrow();
  });

  test("an over-plan grace keeps a link's existing paid settings editable", async () => {
    const workspace = await resolveWorkspaceContext(OVER_PLAN_GRACE_ID, "ishortn.ink", db);
    // SAFETY: updateLink reads ctx.db, ctx.auth.userId, ctx.headers and ctx.workspace.
    const ctx = {
      db,
      auth: { userId: OVER_PLAN_GRACE_ID },
      headers: new Headers({ host: "ishortn.ink" }),
      workspace,
    } as WorkspaceTRPCContext;
    const [withSettings] = await db.insert(schema.link).values({
      url: TARGET_URL,
      alias: uniqueAlias(),
      userId: OVER_PLAN_GRACE_ID,
      utmParams: { utm_source: "kept" },
      activateAt: new Date(Date.now() + 2 * DAY),
    });
    const id = Number(withSettings.insertId);
    const activateAt = new Date(Date.now() + 3 * DAY);
    await updateLink(ctx, { id, utmParams: { utm_source: "changed" }, activateAt });
    const edited = await db.query.link.findFirst({ where: eq(schema.link.id, id) });
    expect(edited?.utmParams).toEqual({ utm_source: "changed" });

    // A link without them can't gain them.
    const [plain] = await db.insert(schema.link).values({
      url: TARGET_URL,
      alias: uniqueAlias(),
      userId: OVER_PLAN_GRACE_ID,
    });
    expect(
      updateLink(ctx, { id: Number(plain.insertId), utmParams: { utm_source: "new" } }),
    ).rejects.toThrow(/UTM parameters/);
  });

  // ---------------------------------------------------------------------------
  // Paid per-link features
  // ---------------------------------------------------------------------------

  // Each paid per-link feature, the lowest plan that has it, and how each write
  // path asks for it (no `api`: the API doesn't offer it; CSV only takes aliases).
  type FeatureCase = {
    name: string;
    plan: Plan;
    dashboard: () => Partial<CreateLinkInput>;
    api?: () => ApiBody;
  };
  const shortAlias = () => `s${aliasCounter++}`.slice(0, 4);
  const FEATURE_CASES: FeatureCase[] = [
    {
      name: "password",
      plan: "pro",
      dashboard: () => ({ password: "hunter22" }),
      api: () => ({ password: "hunter22" }),
    },
    {
      name: "scheduling",
      plan: "pro",
      dashboard: () => ({ activateAt: new Date(Date.now() + DAY) }),
      api: () => ({ activatesAt: new Date(Date.now() + DAY).toISOString() }),
    },
    {
      name: "targeting rules",
      plan: "pro",
      dashboard: () => ({
        geoRules: [
          { type: "country", condition: "in", values: ["GH"], action: "block", blockMessage: "no" },
        ],
      }),
    },
    {
      name: "short alias",
      plan: "pro",
      dashboard: () => ({ alias: shortAlias() }),
      api: () => ({ alias: shortAlias() }),
    },
    { name: "verified clicks", plan: "pro", dashboard: () => ({ verifiedClicksEnabled: true }) },
    {
      name: "UTM parameters",
      plan: "ultra",
      dashboard: () => ({ utmParams: { utm_source: "newsletter" } }),
      api: () => ({ utmParams: { utm_source: "newsletter" } }),
    },
    { name: "cloaking", plan: "ultra", dashboard: () => ({ cloaking: true }) },
  ];

  const allowed = (key: AccountKey, plan: Plan) => planAtLeast(ACCOUNT_PLAN[key], plan);
  const featureCases = ACCOUNT_KEYS.flatMap((key) =>
    FEATURE_CASES.map((feature) => [key, feature.name, feature] as const),
  );

  test.each(featureCases)("dashboard: %s using %s", async (key, _name, feature) => {
    const result = await dashboardCreate(key, feature.dashboard());
    expect(result === "ok").toBe(allowed(key, feature.plan));
  });

  test.each(featureCases.filter(([, , feature]) => feature.api))(
    "API: %s using %s",
    async (key, _name, feature) => {
      const status = await apiCreate(key, feature.api?.() ?? {});
      expect(status === 201).toBe(allowed(key, feature.plan));
    },
  );

  test.each(ACCOUNT_KEYS.map((key) => [key] as const))(
    "CSV: %s short aliases follow the plan",
    async (key) => {
      const result = await csvCreate(key, [{ alias: shortAlias() }]);
      expect(result.created).toBe(allowed(key, "pro") ? 1 : 0);
    },
  );

  test("existing paid settings stay as they are and other fields stay editable", async () => {
    const [inserted] = await db.insert(schema.link).values({
      url: TARGET_URL,
      alias: uniqueAlias(),
      userId: ACCOUNTS.lapsedAfterGrace.id,
      cloaking: true,
      utmParams: { utm_source: "kept" },
      activateAt: new Date(Date.now() + 2 * DAY),
    });
    const id = Number(inserted.insertId);
    const stored = await db.query.link.findFirst({ where: eq(schema.link.id, id) });
    const ctx = await workspaceCtx("lapsedAfterGrace");

    // The edit form resends every field unchanged.
    await updateLink(ctx, {
      id,
      url: `${TARGET_URL}/edited`,
      cloaking: true,
      utmParams: { utm_source: "kept" },
      activateAt: stored?.activateAt ?? null,
    });
    const edited = await db.query.link.findFirst({ where: eq(schema.link.id, id) });
    expect(edited?.url).toBe(`${TARGET_URL}/edited`);
    expect(edited?.cloaking).toBe(true);

    // Changing a paid setting is refused.
    expect(updateLink(ctx, { id, utmParams: { utm_source: "changed" } })).rejects.toThrow(
      /UTM parameters/,
    );
    // Removing one is allowed.
    await updateLink(ctx, { id, cloaking: false });
  });

  // Editing or reordering existing targeting rules through the standalone
  // geo-rule endpoints follows the plan; deleting them is always allowed.
  test.each(ACCOUNT_KEYS.map((key) => [key] as const))(
    "dashboard: %s editing targeting rules follows the plan",
    async (key) => {
      const [inserted] = await db.insert(schema.link).values({
        url: TARGET_URL,
        alias: uniqueAlias(),
        userId: ACCOUNTS[key].id,
      });
      const linkId = Number(inserted.insertId);
      const rule = {
        type: "country",
        condition: "in",
        values: ["GH"],
        action: "block",
        blockMessage: "no",
      } as const;
      const [first] = await db.insert(schema.geoRule).values({ linkId, ...rule, priority: 0 });
      const [second] = await db.insert(schema.geoRule).values({ linkId, ...rule, priority: 1 });
      const ruleIds = [Number(first.insertId), Number(second.insertId)];
      const ctx = await workspaceCtx(key);
      const paid = allowed(key, "pro");

      const update = await updateGeoRule(ctx, {
        ruleId: ruleIds[0]!,
        rule: { ...rule, values: ["NG"], priority: 0 },
      })
        .then(() => "ok")
        .catch((error: Error) => error.message);
      expect(update === "ok").toBe(paid);

      const reorder = await reorderGeoRules(ctx, { linkId, ruleIds: [...ruleIds].reverse() })
        .then(() => "ok")
        .catch((error: Error) => error.message);
      expect(reorder === "ok").toBe(paid);

      const stored = await db.query.geoRule.findFirst({
        where: eq(schema.geoRule.id, ruleIds[0]!),
      });
      expect(stored?.values).toEqual(paid ? ["NG"] : ["GH"]);
      expect(stored?.priority).toBe(paid ? 1 : 0);
    },
  );

  // ---------------------------------------------------------------------------
  // Flows without a domain picker use the default domain within the plan
  // ---------------------------------------------------------------------------

  describe("default custom domain", () => {
    // Each account's default is its second-oldest custom domain.
    beforeAll(async () => {
      await db.insert(schema.siteSettings).values(
        (["pro", "lapsedAfterGrace"] as const).map((key) => ({
          userId: ACCOUNTS[key].id,
          defaultDomain: domainOf(key, 2),
        })),
      );
    });

    const DEFAULT_CASES = [
      ["pro", true],
      ["lapsedAfterGrace", false],
    ] as const;

    test.each(DEFAULT_CASES)("quick shorten: %s keeps its default: %p", async (key, kept) => {
      const ctx = await workspaceCtx(key);
      const created = await shortenLinkWithAutoAlias(ctx, { url: TARGET_URL });
      expect(created?.domain).toBe(kept ? domainOf(key, 2) : DEFAULT_PLATFORM_DOMAIN);
    });

    test.each(DEFAULT_CASES)(
      "bio blocks and QR codes: %s keeps its default: %p",
      async (key, kept) => {
        const ctx = await workspaceCtx(key);
        for (const kind of ["bio", "qr"] as const) {
          const prepared = await prepareHiddenTrackingLink(ctx, {
            url: TARGET_URL,
            name: "Tracking",
            kind,
          });
          expect(prepared.domain).toBe(kept ? domainOf(key, 2) : DEFAULT_PLATFORM_DOMAIN);
        }
      },
    );
  });

  // ---------------------------------------------------------------------------
  // Teams
  // ---------------------------------------------------------------------------

  describe("team workspaces", () => {
    let proTeamId = 0;

    beforeAll(async () => {
      const [proTeam] = await db.insert(schema.team).values({
        name: "Pro-owned team",
        slug: TEAM_SLUGS[0]!,
        ownerId: ACCOUNTS.pro.id,
        ownerPlanGraceEndsAt: new Date(Date.now() - DAY),
      });
      proTeamId = Number(proTeam.insertId);
      const [ultraTeam] = await db.insert(schema.team).values({
        name: "Ultra-owned team",
        slug: TEAM_SLUGS[1]!,
        ownerId: ACCOUNTS.ultra.id,
      });
      await db.insert(schema.teamMember).values([
        { teamId: proTeamId, userId: ACCOUNTS.pro.id, role: "owner" },
        { teamId: proTeamId, userId: ACCOUNTS.free.id, role: "member" },
        { teamId: Number(ultraTeam.insertId), userId: ACCOUNTS.ultra.id, role: "owner" },
      ]);
    });

    function caller(key: AccountKey, slug: string) {
      // SAFETY: the procedures under test read only ctx.auth.userId from auth.
      const auth = { userId: ACCOUNTS[key].id } as TRPCContext["auth"];
      const ctx: TRPCContext = {
        db,
        auth,
        headers: new Headers({ host: `${slug}.localhost:3000` }),
      };
      return linkRouter.createCaller(ctx);
    }

    test.each([["pro"], ["free"]] as const)(
      "a Pro-owned team past grace is read-only for the %s member",
      async (key) => {
        expect(caller(key, TEAM_SLUGS[0]!).create({ url: TARGET_URL })).rejects.toThrow(
          /The workspace owner needs Ultra/,
        );
        // Reads still work.
        const list = await caller(key, TEAM_SLUGS[0]!).list({});
        expect(Array.isArray(list.links)).toBe(true);
      },
    );

    test("a read-only team still lets members export their links", async () => {
      // SAFETY: the procedures under test read only ctx.auth.userId from auth.
      const auth = { userId: ACCOUNTS.free.id } as TRPCContext["auth"];
      const app = appRouter.createCaller({
        db,
        auth,
        headers: new Headers({ host: `${TEAM_SLUGS[0]!}.localhost:3000` }),
      });
      expect(Array.isArray(await app.link.exportUserLinks())).toBe(true);
      expect(app.link.create({ url: TARGET_URL })).rejects.toThrow(
        /The workspace owner needs Ultra/,
      );
    });

    test("an Ultra-owned team stays writable", async () => {
      await caller("ultra", TEAM_SLUGS[1]!).create({ url: TARGET_URL, alias: uniqueAlias() });
    });

    test("the reconcile keeps an expired team grace (no extension)", async () => {
      await reconcileEntitlements();
      const proTeam = await db.query.team.findFirst({ where: eq(schema.team.id, proTeamId) });
      expect(proTeam?.ownerPlanGraceEndsAt?.getTime()).toBeLessThan(Date.now());
    });
  });

  // ---------------------------------------------------------------------------
  // Webhook transitions
  // ---------------------------------------------------------------------------

  test("expiry starts a grace (account and owned teams); resubscribing clears it", async () => {
    const userId = ACCOUNTS.ultra.id;
    const where = eq(schema.subscription.userId, userId);
    const active = await db.query.subscription.findFirst({ where });

    await db.update(schema.subscription).set({ status: "expired" }).where(where);
    await syncEntitlementsAfterBillingEvent(userId, active ?? null);
    const lapsed = await db.query.user.findFirst({ where: eq(schema.user.id, userId) });
    expect(lapsed?.planGracePlan).toBe("ultra");
    expect(lapsed?.planGraceReason).toBe("lapsed");
    const team = await db.query.team.findFirst({ where: eq(schema.team.slug, TEAM_SLUGS[1]!) });
    expect(team?.ownerPlanGraceEndsAt).not.toBeNull();
    // Still Ultra while the grace period runs.
    expect((await workspaceCtx("ultra")).workspace.plan).toBe("ultra");

    const expired = await db.query.subscription.findFirst({ where });
    await db.update(schema.subscription).set({ status: "active" }).where(where);
    await syncEntitlementsAfterBillingEvent(userId, expired ?? null);
    const restored = await db.query.user.findFirst({ where: eq(schema.user.id, userId) });
    expect(restored?.planGraceEndsAt).toBeNull();
    const restoredTeam = await db.query.team.findFirst({
      where: eq(schema.team.slug, TEAM_SLUGS[1]!),
    });
    expect(restoredTeam?.ownerPlanGraceEndsAt).toBeNull();
  });

  test("a cancellation reaching its end date starts the grace from that date", async () => {
    const userId = ACCOUNTS.pro.id;
    const where = eq(schema.subscription.userId, userId);
    const endedAt = new Date(Date.now() - 2 * DAY);
    await db.update(schema.subscription).set({ status: "cancelled", endsAt: endedAt }).where(where);
    const cancelled = await db.query.subscription.findFirst({ where });

    // The expiry webhook resets the row to free, as route.ts does.
    await db
      .update(schema.subscription)
      .set({ status: "expired", plan: "free", variantId: 0, productId: 0, endsAt: new Date() })
      .where(where);
    await syncEntitlementsAfterBillingEvent(userId, cancelled ?? null);
    const lapsed = await db.query.user.findFirst({ where: eq(schema.user.id, userId) });
    expect(lapsed?.planGracePlan).toBe("pro");
    expect(lapsed?.planGraceReason).toBe("lapsed");
    // Stored to the second.
    expect(lapsed?.planGraceEndsAt?.getTime()).toBe(cancelled!.endsAt!.getTime() + 7 * DAY);
    expect((await workspaceCtx("pro")).workspace.plan).toBe("pro");

    // Restore the active Pro subscription for the tests below.
    await db
      .update(schema.subscription)
      .set({ status: "active", plan: "pro", variantId: PRO_VARIANT, endsAt: null })
      .where(where);
    await syncEntitlementsAfterBillingEvent(userId, null);
    const restored = await db.query.user.findFirst({ where: eq(schema.user.id, userId) });
    expect(restored?.planGraceEndsAt).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Reconcile
  // ---------------------------------------------------------------------------

  test("the reconcile starts a lapse grace for a failed payment after a passed over-plan grace", async () => {
    await db.insert(schema.user).values({
      id: PAST_DUE_ID,
      planCheckedAt: new Date(),
      planGracePlan: "ultra",
      planGraceEndsAt: new Date(Date.now() - 10 * DAY),
      planGraceReason: "over_plan",
      planGraceEmailStage: 2,
    });
    await db.insert(schema.subscription).values({
      userId: PAST_DUE_ID,
      subscriptionId: 2,
      status: "past_due",
      variantId: PRO_VARIANT,
      plan: "pro",
    });
    // Covered by the subscribed plan until the lapse grace is recorded.
    const before = await resolveWorkspaceContext(PAST_DUE_ID, "ishortn.ink", db);
    expect(before.plan).toBe("pro");

    await reconcileEntitlements();
    const row = await db.query.user.findFirst({ where: eq(schema.user.id, PAST_DUE_ID) });
    expect(row?.planGraceReason).toBe("lapsed");
    expect(row?.planGracePlan).toBe("pro");
    const endsAt = row?.planGraceEndsAt?.getTime() ?? 0;
    expect(endsAt).toBeGreaterThan(Date.now() + 6.9 * DAY);

    // Once recorded, the next run leaves it alone.
    await reconcileEntitlements();
    const again = await db.query.user.findFirst({ where: eq(schema.user.id, PAST_DUE_ID) });
    expect(again?.planGraceEndsAt?.getTime()).toBe(endsAt);
  });

  test("the reconcile starts a grace for over-plan accounts once, never again", async () => {
    await reconcileEntitlements();
    const free = await db.query.user.findFirst({ where: eq(schema.user.id, ACCOUNTS.free.id) });
    // The free account has three verified custom domains (Pro territory).
    expect(free?.planGraceReason).toBe("over_plan");
    expect(free?.planGracePlan).toBe("pro");
    const endsAt = free?.planGraceEndsAt?.getTime() ?? 0;
    expect(endsAt).toBeGreaterThan(Date.now() + 6.9 * DAY);

    await reconcileEntitlements();
    const again = await db.query.user.findFirst({ where: eq(schema.user.id, ACCOUNTS.free.id) });
    expect(again?.planGraceEndsAt?.getTime()).toBe(endsAt);

    // A lapse whose grace already passed is not extended.
    const lapsed = await db.query.user.findFirst({
      where: eq(schema.user.id, ACCOUNTS.lapsedAfterGrace.id),
    });
    expect(lapsed?.planGraceEndsAt?.getTime()).toBeLessThan(Date.now());
  });
});

// OpenNext reads the request context (and the KV binding behind the cache
// helpers) from this global.
function stubCloudflareContext() {
  const store = new Map<string, string>();
  Reflect.set(globalThis, Symbol.for("__cloudflare-context__"), {
    env: {
      LINK_CACHE_KV: {
        get: async (key: string | string[]) =>
          Array.isArray(key)
            ? new Map(key.map((k) => [k, store.get(k) ?? null]))
            : (store.get(key) ?? null),
        put: async (key: string, value: string) => void store.set(key, value),
        delete: async (key: string) => void store.delete(key),
      },
    },
    cf: {},
    ctx: { waitUntil: () => {} },
  });
}
