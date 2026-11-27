import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import crypto from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { NextRequest } from "next/server";

import { env } from "@/env.mjs";
import { PLAN_VARIANT_IDS } from "@/lib/billing/plans";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { clearApiSunsetCache } from "@/server/lib/api-access";
import { clearPlanLimitHitMemo } from "@/server/lib/plan-limit-hits";

import { GET as getLink } from "./links/[alias]/route";
import { GET as listLinks, POST as createLink } from "./links/route";
import { GET as me } from "./me/route";

// Runs against a disposable MySQL with the schema pushed (test/setup.ts points
// the app's db client at it); see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("team API keys (MySQL)", () => {
  const OWNER_ID = "team_keys_owner";
  const ADMIN_ID = "team_keys_admin";
  const USERS = [OWNER_ID, ADMIN_ID];
  const TEAM_KEY = "team-keys-test-team-key";
  const PERSONAL_KEY = "team-keys-test-personal-key";
  const OTHER_TEAM_KEY = "team-keys-test-other-team-key";
  const TARGET_URL = "http://localhost/team-keys-test";
  const DAY = 24 * 60 * 60 * 1000;
  const originalSunset = env.API_FREE_ACCESS_SUNSET_AT;
  let teamId = 0;
  let otherTeamId = 0;

  beforeAll(() => {
    // Another test file replaces @/env.mjs with a partial object for the whole
    // run, dropping DATABASE_URL; the app's db client reads it on first use.
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
  });

  const hash = (key: string) => crypto.createHash("sha256").update(key).digest("hex");

  async function cleanup() {
    clearApiSunsetCache();
    clearPlanLimitHitMemo();
    Object.assign(env, { API_FREE_ACCESS_SUNSET_AT: originalSunset });
    const teams = await db
      .select({ id: schema.team.id })
      .from(schema.team)
      .where(inArray(schema.team.ownerId, USERS));
    const teamIds = teams.map((row) => row.id);
    if (teamIds.length > 0) {
      await db.delete(schema.link).where(inArray(schema.link.teamId, teamIds));
      await db.delete(schema.token).where(inArray(schema.token.teamId, teamIds));
      await db.delete(schema.teamMember).where(inArray(schema.teamMember.teamId, teamIds));
      await db.delete(schema.team).where(inArray(schema.team.id, teamIds));
    }
    await db.delete(schema.planLimitHit).where(inArray(schema.planLimitHit.userId, USERS));
    await db.delete(schema.link).where(inArray(schema.link.userId, USERS));
    await db.delete(schema.token).where(inArray(schema.token.userId, USERS));
    await db.delete(schema.subscription).where(inArray(schema.subscription.userId, USERS));
    await db.delete(schema.user).where(inArray(schema.user.id, USERS));
  }

  async function addTeam(slug: string) {
    const [inserted] = await db
      .insert(schema.team)
      .values({ name: `Team ${slug}`, slug, ownerId: OWNER_ID });
    await db.insert(schema.teamMember).values([
      { teamId: inserted.insertId, userId: OWNER_ID, role: "owner" },
      { teamId: inserted.insertId, userId: ADMIN_ID, role: "admin" },
    ]);
    return inserted.insertId;
  }

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values(
      USERS.map((id) => ({
        id,
        email: `${id}@example.com`,
        name: id,
        // Checked already, so the first request doesn't start a plan grace.
        planCheckedAt: new Date(),
      })),
    );
    await db.insert(schema.subscription).values([
      // The owner pays for Ultra; the admin who creates the keys is on Pro.
      {
        userId: OWNER_ID,
        status: "active",
        plan: "ultra",
        variantId: PLAN_VARIANT_IDS.ultra.monthly,
      },
      { userId: ADMIN_ID, status: "active", plan: "pro", variantId: PLAN_VARIANT_IDS.pro.monthly },
    ]);
    teamId = await addTeam("team-keys-a");
    otherTeamId = await addTeam("team-keys-b");
    await db.insert(schema.token).values([
      { userId: ADMIN_ID, createdByUserId: ADMIN_ID, teamId, token: hash(TEAM_KEY) },
      { userId: ADMIN_ID, token: hash(PERSONAL_KEY) },
      {
        userId: OWNER_ID,
        createdByUserId: OWNER_ID,
        teamId: otherTeamId,
        token: hash(OTHER_TEAM_KEY),
      },
    ]);
  });

  afterAll(cleanup);

  function create(apiKey: string, alias: string) {
    return createLink(
      new Request("http://localhost/api/v1/links", {
        method: "POST",
        headers: { "x-api-key": apiKey, "content-type": "application/json" },
        body: JSON.stringify({ url: TARGET_URL, alias }),
      }),
    );
  }

  async function list(apiKey: string) {
    const response = await listLinks(
      new NextRequest("http://localhost/api/v1/links", { headers: { "x-api-key": apiKey } }),
    );
    expect(response.status).toBe(200);
    const body: { data: { alias: string }[] } = await response.json();
    return body.data.map((row) => row.alias).sort();
  }

  function get(apiKey: string, alias: string) {
    return getLink(
      new NextRequest(`http://localhost/api/v1/links/${alias}`, {
        headers: { "x-api-key": apiKey },
      }),
      { params: Promise.resolve({ alias }) },
    );
  }

  function meWith(apiKey: string) {
    return me(new Request("http://localhost/api/v1/me", { headers: { "x-api-key": apiKey } }));
  }

  test("a team key creates links in the team, attributed to the key's creator", async () => {
    const response = await create(TEAM_KEY, "teamkey-created");
    expect(response.status).toBe(201);

    const stored = await db.query.link.findFirst({
      where: eq(schema.link.alias, "teamkey-created"),
    });
    expect(stored).toMatchObject({ teamId, userId: ADMIN_ID, createdByUserId: ADMIN_ID });
    // Team links don't use the creator's personal monthly quota.
    const admin = await db.query.user.findFirst({ where: eq(schema.user.id, ADMIN_ID) });
    expect(admin?.monthlyLinkCount ?? 0).toBe(0);
  });

  test("each key lists and reads only its own workspace's links", async () => {
    expect((await create(TEAM_KEY, "teamkey-team")).status).toBe(201);
    expect((await create(PERSONAL_KEY, "teamkey-personal")).status).toBe(201);
    expect((await create(OTHER_TEAM_KEY, "teamkey-other")).status).toBe(201);

    expect(await list(TEAM_KEY)).toEqual(["teamkey-team"]);
    expect(await list(PERSONAL_KEY)).toEqual(["teamkey-personal"]);
    expect(await list(OTHER_TEAM_KEY)).toEqual(["teamkey-other"]);

    expect((await get(TEAM_KEY, "teamkey-team")).status).toBe(200);
    // Not the creator's personal links, and not another team's.
    expect((await get(TEAM_KEY, "teamkey-personal")).status).toBe(404);
    expect((await get(TEAM_KEY, "teamkey-other")).status).toBe(404);
    // A personal key keeps today's scope: no team links.
    expect((await get(PERSONAL_KEY, "teamkey-team")).status).toBe(404);
  });

  test("/me reports the workspace each key acts in", async () => {
    const team = await (await meWith(TEAM_KEY)).json();
    expect(team).toMatchObject({
      id: ADMIN_ID,
      plan: "ultra",
      workspace: { type: "team", id: teamId, name: "Team team-keys-a", slug: "team-keys-a" },
      usage: { linksThisMonth: 0, linksLimit: null },
    });

    const personal = await (await meWith(PERSONAL_KEY)).json();
    expect(personal).toMatchObject({ id: ADMIN_ID, plan: "pro", workspace: { type: "personal" } });
  });

  test("a team key keeps working after its creator leaves the team", async () => {
    await db.delete(schema.teamMember).where(eq(schema.teamMember.userId, ADMIN_ID));
    expect((await create(TEAM_KEY, "teamkey-after-leave")).status).toBe(201);
  });

  test("a team past its owner's plan grace gets the same 403 as a lapsed personal key", async () => {
    Object.assign(env, { API_FREE_ACCESS_SUNSET_AT: new Date(Date.now() - DAY).toISOString() });
    await db.delete(schema.subscription).where(inArray(schema.subscription.userId, USERS));
    await db
      .update(schema.team)
      .set({ ownerPlanGraceEndsAt: new Date(Date.now() - DAY) })
      .where(eq(schema.team.id, teamId));

    const teamResponse = await meWith(TEAM_KEY);
    const personalResponse = await meWith(PERSONAL_KEY);
    expect(teamResponse.status).toBe(403);
    expect(personalResponse.status).toBe(403);
    expect(await teamResponse.json()).toEqual(await personalResponse.json());
  });

  test("a team key keeps Ultra during the team grace, even with the owner on Free", async () => {
    await db.delete(schema.subscription).where(eq(schema.subscription.userId, OWNER_ID));
    await db
      .update(schema.team)
      .set({ ownerPlanGraceEndsAt: new Date(Date.now() + DAY) })
      .where(eq(schema.team.id, teamId));

    const response = await meWith(TEAM_KEY);
    expect(response.status).toBe(200);
    expect((await response.json()).plan).toBe("ultra");
  });

  test("a deleted team's keys are refused", async () => {
    await db.update(schema.team).set({ deletedAt: new Date() }).where(eq(schema.team.id, teamId));

    expect((await meWith(TEAM_KEY)).status).toBe(403);
    expect((await create(TEAM_KEY, "teamkey-deleted")).status).toBe(403);
  });
});
