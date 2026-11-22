import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";

import { createBioPage } from "@/server/api/routers/bio-page/bio-page.service";
import { lockBioLinkBlockCapacity } from "@/server/api/routers/bio-page/utils";
import { createCampaign } from "@/server/api/routers/campaign/campaign.service";
import { addDomainToUserAccount } from "@/server/api/routers/domains/domains.service";
import { createFolder } from "@/server/api/routers/folder/folder.service";
import { createGeoRule } from "@/server/api/routers/geo-rules/geo-rules.service";
import { upsertMilestones } from "@/server/api/routers/link-milestone/link-milestone.service";
import { updateLink } from "@/server/api/routers/link/link.service";
import { createQrCode } from "@/server/api/routers/qrcode/qrcode.service";
import { createToken } from "@/server/api/routers/token/token.service";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { clearPlanLimitHitMemo, recordPlanLimitHit } from "./plan-limit-hits";
import { reserveMonthlyLinkSlot } from "./user-plan";

import type { PlanLimitKey } from "@/lib/billing/plan-limits";
import type { WorkspaceTRPCContext } from "@/server/api/trpc";

describe("recordPlanLimitHit", () => {
  test("a failing write resolves instead of throwing", async () => {
    const failingDb = {
      insert: () => {
        throw new Error("connection lost");
      },
    };
    const write = recordPlanLimitHit(
      { userId: "plan_limit_unit", limitKey: "folders", plan: "free" },
      failingDb,
    );
    expect(await write).toBeUndefined();
  });
});

// Every rejected action is exercised against a real MySQL so the row (and the
// rollback of the surrounding transaction) is what production sees. Set
// TEST_DATABASE_URL to run them; see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("PlanLimitHit logging (MySQL)", () => {
  const USER_ID = "plan_limit_hit_test";
  const ctx: Pick<WorkspaceTRPCContext, "db" | "headers" | "workspace"> & {
    auth: Pick<WorkspaceTRPCContext["auth"], "userId">;
  } = {
    db,
    headers: new Headers(),
    auth: { userId: USER_ID },
    workspace: {
      type: "personal",
      userId: USER_ID,
      teamId: null,
      teamSlug: null,
      role: "owner",
      plan: "free",
    },
  };
  // SAFETY: the services under test only read ctx.db, ctx.auth.userId and
  // ctx.workspace, which match a free personal workspace.
  const workspaceCtx = ctx as WorkspaceTRPCContext;

  async function cleanup() {
    clearPlanLimitHitMemo();
    await db.delete(schema.planLimitHit).where(eq(schema.planLimitHit.userId, USER_ID));
    const pages = await db
      .select({ id: schema.bioPage.id })
      .from(schema.bioPage)
      .where(eq(schema.bioPage.userId, USER_ID));
    for (const page of pages) {
      await db.delete(schema.bioBlock).where(eq(schema.bioBlock.bioPageId, page.id));
    }
    await db.delete(schema.bioPage).where(eq(schema.bioPage.userId, USER_ID));
    await db.delete(schema.campaign).where(eq(schema.campaign.userId, USER_ID));
    await db.delete(schema.qrcode).where(eq(schema.qrcode.userId, USER_ID));
    await db.delete(schema.link).where(eq(schema.link.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  }

  async function hits(limitKey: string) {
    return db
      .select()
      .from(schema.planLimitHit)
      .where(
        and(eq(schema.planLimitHit.userId, USER_ID), eq(schema.planLimitHit.limitKey, limitKey)),
      );
  }

  async function seedLink() {
    const [res] = await db.insert(schema.link).values({
      url: "https://example.com",
      alias: crypto.randomUUID().slice(0, 12),
      domain: "ishortn.ink",
      userId: USER_ID,
      createdByUserId: USER_ID,
    });
    return Number(res.insertId);
  }

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values({
      id: USER_ID,
      email: `${USER_ID}@example.com`,
      lastLinkCountReset: new Date(),
    });
  });

  afterAll(cleanup);

  let editedLinkId = 0;

  // Each case seeds what the plan check needs, then runs the rejected action twice:
  // the first rejection logs one row, the second (same day) adds none.
  const cases: {
    limitKey: PlanLimitKey;
    label?: string;
    seed?: () => Promise<object | number | void>;
    run: () => Promise<object | void>;
  }[] = [
    {
      limitKey: "monthly_links",
      seed: () =>
        db.update(schema.user).set({ monthlyLinkCount: 30 }).where(eq(schema.user.id, USER_ID)),
      run: () => db.transaction((tx) => reserveMonthlyLinkSlot(USER_ID, tx)),
    },
    {
      limitKey: "qr_codes",
      seed: () =>
        db.insert(schema.qrcode).values(
          Array.from({ length: 5 }, () => ({
            userId: USER_ID,
            content: "https://example.com",
            color: "#000000",
          })),
        ),
      run: () =>
        createQrCode(workspaceCtx, {
          content: "https://example.com",
          patternStyle: "square",
          cornerStyle: "square",
          selectedColor: "#000000",
        }),
    },
    {
      limitKey: "bio_pages",
      seed: () => db.insert(schema.bioPage).values({ userId: USER_ID, slug: `plt-${Date.now()}` }),
      run: () => createBioPage(workspaceCtx, { slug: `plt-new-${Date.now()}`, title: "New" }),
    },
    {
      limitKey: "bio_link_blocks",
      seed: async () => {
        const [page] = await db
          .insert(schema.bioPage)
          .values({ userId: USER_ID, slug: `plt-blocks-${Date.now()}` });
        const bioPageId = Number(page.insertId);
        await db.insert(schema.bioBlock).values(
          Array.from({ length: 3 }, (_, position) => ({
            bioPageId,
            type: "link" as const,
            position,
          })),
        );
      },
      run: async () => {
        const [page] = await db
          .select({ id: schema.bioPage.id })
          .from(schema.bioPage)
          .where(eq(schema.bioPage.userId, USER_ID));
        // addBlock runs this inside the transaction that inserts the block.
        return db.transaction((tx) => lockBioLinkBlockCapacity(tx, "free", page!.id, USER_ID));
      },
    },
    {
      limitKey: "campaigns",
      seed: () =>
        db.insert(schema.campaign).values({ userId: USER_ID, name: "Launch", slug: "launch" }),
      run: () => createCampaign(workspaceCtx, { name: "Second" }),
    },
    {
      limitKey: "custom_domains",
      run: () => addDomainToUserAccount(workspaceCtx, { domain: "links.example.com" }),
    },
    {
      limitKey: "folders",
      run: () => createFolder(workspaceCtx, { name: "Clients" }),
    },
    {
      limitKey: "geo_rules",
      seed: seedLink,
      run: async () =>
        createGeoRule(workspaceCtx, {
          linkId: (await db.query.link.findFirst({ where: eq(schema.link.userId, USER_ID) }))!.id,
          rule: {
            type: "country",
            condition: "in",
            values: ["US"],
            action: "block",
            priority: 0,
          },
        }),
    },
    {
      limitKey: "geo_rules",
      label: "geo_rules (link edit)",
      seed: async () => (editedLinkId = await seedLink()),
      run: () =>
        updateLink(workspaceCtx, {
          id: editedLinkId,
          geoRules: [
            { type: "country", condition: "in", values: ["US"], action: "block", priority: 0 },
          ],
        }),
    },
    {
      limitKey: "milestones",
      seed: seedLink,
      run: async () =>
        upsertMilestones(workspaceCtx, {
          linkId: (await db.query.link.findFirst({ where: eq(schema.link.userId, USER_ID) }))!.id,
          thresholds: [100],
        }),
    },
    {
      limitKey: "api_keys",
      run: () => createToken(workspaceCtx, { name: "CI" }),
    },
  ];

  for (const { limitKey, label, seed, run } of cases) {
    test(`a rejected ${label ?? limitKey} action logs one row per day`, async () => {
      await seed?.();

      await expect(run()).rejects.toThrow();
      expect((await hits(limitKey)).map((hit) => hit.plan)).toEqual(["free"]);

      clearPlanLimitHitMemo();
      await expect(run()).rejects.toThrow();
      expect(await hits(limitKey)).toHaveLength(1);
    });
  }

  test("a link edit with targeting rules on Free is rejected as FORBIDDEN", async () => {
    const id = await seedLink();
    const edit = updateLink(workspaceCtx, {
      id,
      geoRules: [
        { type: "country", condition: "in", values: ["US"], action: "block", priority: 0 },
      ],
    });
    await expect(edit).rejects.toBeInstanceOf(TRPCError);
    await expect(edit).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("concurrent hits from different isolates still write one row", async () => {
    const hit = { userId: USER_ID, limitKey: "folders", plan: "free" } as const;
    await Promise.all([recordPlanLimitHit(hit), recordPlanLimitHit(hit), recordPlanLimitHit(hit)]);
    expect(await hits("folders")).toHaveLength(1);
  });

  test("a logging failure leaves the rejection unchanged", async () => {
    // Make every PlanLimitHit write fail by taking the table away for this case.
    await db.execute(sql`RENAME TABLE PlanLimitHit TO PlanLimitHit_offline`);
    try {
      await expect(createFolder(workspaceCtx, { name: "Clients" })).rejects.toThrow(
        "Folders are available on Pro and Ultra plans. Upgrade to create folders.",
      );
    } finally {
      await db.execute(sql`RENAME TABLE PlanLimitHit_offline TO PlanLimitHit`);
    }
  });
});
