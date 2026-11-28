import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import crypto from "node:crypto";

import { eq, inArray, like } from "drizzle-orm";
import { NextRequest } from "next/server";

import { DELETE, PATCH } from "@/app/api/v1/links/[alias]/route";
import { POST } from "@/app/api/v1/links/route";
import { env } from "@/env.mjs";
import { PLAN_VARIANT_IDS } from "@/lib/billing/plans";
import { DEFAULT_PLATFORM_DOMAIN } from "@/lib/constants/domains";
import {
  bulkDeleteLinks,
  createLink,
  deleteLink,
  shortenLinkWithAutoAlias,
  updateLink,
} from "@/server/api/routers/link/link.service";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { parseScrapedPage } from "@/server/lib/metadata";
import { getTeamWorkspaceContextById } from "@/server/lib/workspace/workspace.service";

import type { WebhookEvent } from "./delivery";
import type { WebhookEventType } from "@/lib/webhooks";
import type { WorkspaceTRPCContext } from "@/server/api/trpc";

/** Endpoint ids by role, set up in beforeEach. */
type EndpointIds = {
  all: number;
  createdOnly: number;
  domainOnly: number;
  team: number;
  other: number;
};

// Runs against a disposable MySQL with the schema pushed (test/setup.ts points the app's db
// client at it); see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

// Every link write path, run for real, records one delivery per subscribed endpoint of its own
// workspace. Endpoints point at 127.0.0.1, so each attempt fails the per-attempt address check
// without a network call; the delivery row is what's asserted.
describe.skipIf(!testDatabaseUrl)("link webhook events (MySQL)", () => {
  const OWNER = "webhook_events_owner";
  const OTHER = "webhook_events_other";
  const USERS = [OWNER, OTHER];
  const API_KEY = "webhook-events-test-key";
  const TEAM_SLUG = "webhook-events-test";
  const ALL_LINK_EVENTS: WebhookEventType[] = ["link.created", "link.updated", "link.deleted"];

  let teamId: number;
  // Endpoints by role: personal ones subscribed to everything, to link.created only and to
  // domain.verified only; the team's; and another account's.
  let ids: EndpointIds;

  // OpenNext reads the request context from this global. The emits hand their dispatch to
  // waitUntil, which collects it here; no KV bindings, so caches and API rate limits are no-ops.
  const CLOUDFLARE_CONTEXT = Symbol.for("__cloudflare-context__");
  const background: Promise<unknown>[] = [];

  /** Waits for every waitUntil task, including ones started by other tasks. */
  async function settle() {
    while (background.length > 0) await Promise.allSettled(background.splice(0));
  }

  const personalCtx = (): WorkspaceTRPCContext =>
    // SAFETY: the link services read only db, auth.userId, restrictedAt and the personal
    // workspace fields set here.
    ({
      db,
      auth: { userId: OWNER },
      restrictedAt: null,
      workspace: {
        type: "personal",
        userId: OWNER,
        teamId: null,
        teamSlug: null,
        role: "owner",
        plan: "pro",
      },
    }) as WorkspaceTRPCContext;

  const teamCtx = async (): Promise<WorkspaceTRPCContext> =>
    // SAFETY: as personalCtx, with the team workspace the dashboard would resolve.
    ({
      db,
      auth: { userId: OWNER },
      restrictedAt: null,
      workspace: await getTeamWorkspaceContextById(OWNER, teamId, db),
    }) as WorkspaceTRPCContext;

  // Safety layers that pass the URL without network calls, and no metadata fetch.
  const deps = {
    preChecks: async () => ({ blocked: false, reason: "", userMessage: "" }),
    readVerdict: async () => false,
    rememberVerdict: () => {},
    scrape: async (url: string) => parseScrapedPage("<title>Page</title>", url, 200, new Headers()),
    detect: async (url: string) => ({ url, phishing: false }),
    checkAfterResponse: async () => {},
    fetchMetadata: async () => ({ title: "", description: "", image: "", favicon: "" }),
  };

  async function cleanup() {
    const teams = await db
      .select({ id: schema.team.id })
      .from(schema.team)
      .where(eq(schema.team.slug, TEAM_SLUG));
    const teamIds = teams.map((t) => t.id);
    const webhooks = await db
      .select({ id: schema.webhook.id })
      .from(schema.webhook)
      .where(inArray(schema.webhook.userId, USERS));
    if (webhooks.length > 0) {
      const webhookIds = webhooks.map((w) => w.id);
      await db
        .delete(schema.webhookDelivery)
        .where(inArray(schema.webhookDelivery.webhookId, webhookIds));
      await db.delete(schema.webhook).where(inArray(schema.webhook.id, webhookIds));
    }
    // Deleted and renamed links leave their addresses reserved.
    await db
      .delete(schema.linkPreviousAddress)
      .where(like(schema.linkPreviousAddress.alias, "whe-%"));
    await db.delete(schema.reservedAlias).where(like(schema.reservedAlias.alias, "whe-%"));
    await db.delete(schema.link).where(inArray(schema.link.userId, USERS));
    if (teamIds.length > 0) {
      await db.delete(schema.teamMember).where(inArray(schema.teamMember.teamId, teamIds));
      await db.delete(schema.team).where(inArray(schema.team.id, teamIds));
    }
    await db.delete(schema.token).where(inArray(schema.token.userId, USERS));
    await db.delete(schema.subscription).where(inArray(schema.subscription.userId, USERS));
    await db.delete(schema.user).where(inArray(schema.user.id, USERS));
  }

  async function addEndpoint(
    name: string,
    values: { userId: string; teamId?: number; events?: WebhookEventType[] },
  ) {
    const [result] = await db.insert(schema.webhook).values({
      url: `https://127.0.0.1/${name}`,
      events: [...ALL_LINK_EVENTS, "domain.verified"],
      secret: "whsec_test",
      ...values,
    });
    return Number(result.insertId);
  }

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
    Reflect.set(globalThis, CLOUDFLARE_CONTEXT, {
      env: {},
      cf: {},
      ctx: { waitUntil: (promise: Promise<unknown>) => void background.push(promise) },
    });
  });

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values(USERS.map((id) => ({ id, planCheckedAt: new Date() })));
    // Ultra: Pro webhooks for the personal workspace, and the plan a team needs.
    await db.insert(schema.subscription).values(
      USERS.map((userId) => ({
        userId,
        plan: "ultra" as const,
        variantId: PLAN_VARIANT_IDS.ultra.monthly,
        status: "active",
      })),
    );
    await db.insert(schema.token).values({
      userId: OWNER,
      token: crypto.createHash("sha256").update(API_KEY).digest("hex"),
    });
    const [team] = await db
      .insert(schema.team)
      .values({ name: "Webhook events", slug: TEAM_SLUG, ownerId: OWNER });
    teamId = Number(team.insertId);
    await db.insert(schema.teamMember).values({ teamId, userId: OWNER, role: "owner" });
    ids = {
      all: await addEndpoint("all", { userId: OWNER }),
      createdOnly: await addEndpoint("created-only", { userId: OWNER, events: ["link.created"] }),
      domainOnly: await addEndpoint("domain-only", { userId: OWNER, events: ["domain.verified"] }),
      team: await addEndpoint("team", { userId: OWNER, teamId }),
      other: await addEndpoint("other", { userId: OTHER }),
    };
  });

  afterAll(async () => {
    await settle();
    await cleanup();
    Reflect.deleteProperty(globalThis, CLOUDFLARE_CONTEXT);
  });

  /** Deliveries recorded since the last call, as [endpoint, event type, workspace, alias]. */
  async function deliveries() {
    await settle();
    const rows = await db
      .select()
      .from(schema.webhookDelivery)
      .where(inArray(schema.webhookDelivery.webhookId, Object.values(ids)))
      .orderBy(schema.webhookDelivery.webhookId, schema.webhookDelivery.id);
    await db
      .delete(schema.webhookDelivery)
      .where(inArray(schema.webhookDelivery.webhookId, Object.values(ids)));
    return rows.map((row) => {
      const event: WebhookEvent = JSON.parse(row.payload);
      expect(String(event.type)).toBe(row.eventType);
      const alias = "alias" in event.data ? event.data.alias : undefined;
      return [row.webhookId, row.eventType, event.workspace, alias];
    });
  }

  async function insertLink(alias: string, team?: number) {
    const [result] = await db.insert(schema.link).values({
      url: "https://example.com/destination",
      alias,
      domain: DEFAULT_PLATFORM_DOMAIN,
      userId: OWNER,
      teamId: team ?? null,
    });
    return Number(result.insertId);
  }

  const personal = { type: "personal", id: OWNER };

  describe("dashboard", () => {
    test("createLink: link.created to each subscribed personal endpoint", async () => {
      await createLink(personalCtx(), { url: "https://example.com/a", alias: "whe-create" }, deps);

      expect(await deliveries()).toEqual([
        [ids.all, "link.created", personal, "whe-create"],
        [ids.createdOnly, "link.created", personal, "whe-create"],
      ]);
    });

    test("shortenLinkWithAutoAlias: link.created to each subscribed personal endpoint", async () => {
      const { alias } = await shortenLinkWithAutoAlias(
        personalCtx(),
        { url: "https://example.com/quick" },
        deps,
      );

      expect(await deliveries()).toEqual([
        [ids.all, "link.created", personal, alias],
        [ids.createdOnly, "link.created", personal, alias],
      ]);
    });

    test("updateLink: link.updated only to endpoints subscribed to it", async () => {
      const id = await insertLink("whe-update");

      await updateLink(personalCtx(), { id, name: "Renamed" });

      expect(await deliveries()).toEqual([[ids.all, "link.updated", personal, "whe-update"]]);
    });

    test("deleteLink: link.deleted only to endpoints subscribed to it", async () => {
      const id = await insertLink("whe-delete");

      await deleteLink(personalCtx(), { id });

      expect(await deliveries()).toEqual([[ids.all, "link.deleted", personal, "whe-delete"]]);
    });

    test("bulkDeleteLinks: one link.deleted per link per subscribed endpoint", async () => {
      const first = await insertLink("whe-bulk-1");
      const second = await insertLink("whe-bulk-2");

      await bulkDeleteLinks(personalCtx(), [first, second]);

      expect(await deliveries()).toEqual([
        [ids.all, "link.deleted", personal, "whe-bulk-1"],
        [ids.all, "link.deleted", personal, "whe-bulk-2"],
      ]);
    });

    test("team links go only to the team's endpoints", async () => {
      const ctx = await teamCtx();
      const team = { type: "team", id: teamId };

      await createLink(ctx, { url: "https://example.com/t", alias: "whe-team" }, deps);
      expect(await deliveries()).toEqual([[ids.team, "link.created", team, "whe-team"]]);

      const id = await insertLink("whe-team-edit", teamId);
      await updateLink(ctx, { id, name: "Renamed" });
      expect(await deliveries()).toEqual([[ids.team, "link.updated", team, "whe-team-edit"]]);

      await deleteLink(ctx, { id });
      expect(await deliveries()).toEqual([[ids.team, "link.deleted", team, "whe-team-edit"]]);

      const bulk = await insertLink("whe-team-bulk", teamId);
      await bulkDeleteLinks(ctx, [bulk]);
      expect(await deliveries()).toEqual([[ids.team, "link.deleted", team, "whe-team-bulk"]]);
    });
  });

  describe("v1 API", () => {
    const headers = { "x-api-key": API_KEY, "content-type": "application/json" };
    const params = (alias: string) => ({ params: Promise.resolve({ alias }) });

    test("POST /links: link.created to each subscribed personal endpoint", async () => {
      const response = await POST(
        new Request("http://localhost/api/v1/links", {
          method: "POST",
          headers,
          // localhost is refused by the metadata scraper, so the safety check fails open offline.
          body: JSON.stringify({ url: "http://localhost/webhook-events", alias: "whe-api" }),
        }),
      );
      expect(response.status).toBe(201);

      expect(await deliveries()).toEqual([
        [ids.all, "link.created", personal, "whe-api"],
        [ids.createdOnly, "link.created", personal, "whe-api"],
      ]);
    });

    test("PATCH /links/:alias: link.updated only to endpoints subscribed to it", async () => {
      await insertLink("whe-api-edit");

      const response = await PATCH(
        new NextRequest("http://localhost/api/v1/links/whe-api-edit", {
          method: "PATCH",
          headers,
          body: JSON.stringify({ alias: "whe-api-renamed" }),
        }),
        params("whe-api-edit"),
      );
      expect(response.status).toBe(200);

      expect(await deliveries()).toEqual([[ids.all, "link.updated", personal, "whe-api-renamed"]]);
    });

    test("DELETE /links/:alias: link.deleted only to endpoints subscribed to it", async () => {
      await insertLink("whe-api-delete");

      const response = await DELETE(
        new NextRequest("http://localhost/api/v1/links/whe-api-delete", {
          method: "DELETE",
          headers,
        }),
        params("whe-api-delete"),
      );
      expect(response.status).toBe(204);

      expect(await deliveries()).toEqual([[ids.all, "link.deleted", personal, "whe-api-delete"]]);
    });
  });
});
