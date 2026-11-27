import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq } from "drizzle-orm";

import { getWebhookEndpointLimit } from "@/lib/billing/plans";
import { DEFAULT_PLATFORM_DOMAIN } from "@/lib/constants/domains";
import { webhook, webhookDelivery } from "@/server/db/schema";
import { toApiLink } from "@/server/lib/api-link";
import { recordPlanLimitHit } from "@/server/lib/plan-limit-hits";
import { webhookDeliveryDeps } from "@/server/lib/webhooks";
import {
  attemptDelivery,
  buildWebhookEvent,
  WEBHOOK_LOG_SIZE,
  WEBHOOK_TEST_EVENT,
} from "@/server/lib/webhooks/delivery";
import { generateWebhookSecret } from "@/server/lib/webhooks/signature";
import { dbWebhookStore } from "@/server/lib/webhooks/store";
import { webhookUrlError } from "@/server/lib/webhooks/url";
import {
  hasPermission,
  requirePermission,
  workspaceFilter,
  workspaceOwnership,
} from "@/server/lib/workspace";

import type { WorkspaceTRPCContext } from "../../trpc";
import type { CreateWebhookInput, UpdateWebhookInput, WebhookIdInput } from "./webhook.input";

const MANAGE_ACTION = "manage this workspace's webhooks";

const assertValidUrl = async (url: string) => {
  const error = await webhookUrlError(url);
  if (error) throw new TRPCError({ code: "BAD_REQUEST", message: error });
};

/** The endpoint by id in the caller's workspace; NOT_FOUND otherwise. */
const getOwnedWebhook = async (ctx: WorkspaceTRPCContext, id: number) => {
  const [row] = await ctx.db
    .select()
    .from(webhook)
    .where(and(eq(webhook.id, id), workspaceFilter(ctx.workspace, webhook.userId, webhook.teamId)))
    .limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
  return row;
};

export const listWebhooks = async (ctx: WorkspaceTRPCContext) => {
  const endpoints = await ctx.db
    .select({
      id: webhook.id,
      url: webhook.url,
      description: webhook.description,
      events: webhook.events,
      enabled: webhook.enabled,
      consecutiveFailures: webhook.consecutiveFailures,
      disabledAt: webhook.disabledAt,
      createdAt: webhook.createdAt,
    })
    .from(webhook)
    .where(workspaceFilter(ctx.workspace, webhook.userId, webhook.teamId))
    .orderBy(asc(webhook.createdAt));

  return {
    endpoints,
    limit: getWebhookEndpointLimit(ctx.workspace.plan),
    canManage: hasPermission(ctx.workspace, "team.settings"),
  };
};

const WEBHOOKS_PLAN_REQUIRED =
  "Webhooks are available on Pro and Ultra plans. Upgrade to add an endpoint.";

export const createWebhook = async (ctx: WorkspaceTRPCContext, input: CreateWebhookInput) => {
  requirePermission(ctx.workspace, "team.settings", MANAGE_ACTION);
  const plan = ctx.workspace.plan;
  const limit = getWebhookEndpointLimit(plan);
  if (limit === 0) {
    await recordPlanLimitHit({ userId: ctx.auth.userId, limitKey: "webhooks", plan });
    throw new TRPCError({
      code: "FORBIDDEN",
      message: WEBHOOKS_PLAN_REQUIRED,
    });
  }
  await assertValidUrl(input.url);

  const secret = generateWebhookSecret();
  const id = await ctx.db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ count: count() })
      .from(webhook)
      .where(workspaceFilter(ctx.workspace, webhook.userId, webhook.teamId));
    if ((existing?.count ?? 0) >= limit) {
      await recordPlanLimitHit({ userId: ctx.auth.userId, limitKey: "webhooks", plan });
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          plan === "ultra"
            ? `You can add up to ${limit} webhook endpoints. Remove one to add another.`
            : `Your plan allows ${limit} webhook endpoints. Upgrade to Ultra for up to ${getWebhookEndpointLimit("ultra")}.`,
      });
    }
    const [inserted] = await tx.insert(webhook).values({
      ...workspaceOwnership(ctx.workspace),
      url: input.url,
      description: input.description || null,
      events: input.events,
      secret,
    });
    return Number(inserted.insertId);
  });

  return { id, secret };
};

export const updateWebhook = async (ctx: WorkspaceTRPCContext, input: UpdateWebhookInput) => {
  requirePermission(ctx.workspace, "team.settings", MANAGE_ACTION);
  const existing = await getOwnedWebhook(ctx, input.id);
  if (input.url !== undefined && input.url !== existing.url) await assertValidUrl(input.url);

  const changes: Partial<typeof webhook.$inferInsert> = {
    url: input.url,
    description: input.description === undefined ? undefined : input.description || null,
    events: input.events,
    enabled: input.enabled,
  };
  // Turning an endpoint back on starts its failure count over.
  if (input.enabled === true && !existing.enabled) {
    changes.consecutiveFailures = 0;
    changes.disabledAt = null;
  }
  await ctx.db
    .update(webhook)
    .set(changes)
    .where(
      and(
        eq(webhook.id, existing.id),
        workspaceFilter(ctx.workspace, webhook.userId, webhook.teamId),
      ),
    );
  return { success: true };
};

export const deleteWebhook = async (ctx: WorkspaceTRPCContext, input: WebhookIdInput) => {
  requirePermission(ctx.workspace, "team.settings", MANAGE_ACTION);
  const existing = await getOwnedWebhook(ctx, input.id);
  await ctx.db.transaction(async (tx) => {
    await tx.delete(webhookDelivery).where(eq(webhookDelivery.webhookId, existing.id));
    await tx.delete(webhook).where(eq(webhook.id, existing.id));
  });
  return { success: true };
};

export const rollWebhookSecret = async (ctx: WorkspaceTRPCContext, input: WebhookIdInput) => {
  requirePermission(ctx.workspace, "team.settings", MANAGE_ACTION);
  const existing = await getOwnedWebhook(ctx, input.id);
  const secret = generateWebhookSecret();
  await ctx.db.update(webhook).set({ secret }).where(eq(webhook.id, existing.id));
  return { secret };
};

/** Sends one `webhook.test` event now and returns how the endpoint answered. */
export const sendTestWebhook = async (ctx: WorkspaceTRPCContext, input: WebhookIdInput) => {
  requirePermission(ctx.workspace, "team.settings", MANAGE_ACTION);
  // Endpoints kept after a downgrade stay visible, but the plan no longer sends to them.
  if (getWebhookEndpointLimit(ctx.workspace.plan) === 0) {
    throw new TRPCError({ code: "FORBIDDEN", message: WEBHOOKS_PLAN_REQUIRED });
  }
  const existing = await getOwnedWebhook(ctx, input.id);
  const now = new Date();
  const event = buildWebhookEvent(
    workspaceOwnership(ctx.workspace),
    WEBHOOK_TEST_EVENT,
    toApiLink({
      id: 0,
      createdAt: now,
      domain: DEFAULT_PLATFORM_DOMAIN,
      alias: "example",
      url: "https://example.com",
      disableLinkAfterDate: null,
      activateAt: null,
      disableLinkAfterClicks: null,
    }),
    now,
  );

  const store = dbWebhookStore(ctx.db);
  const [job] = await store.insertDeliveries([
    {
      webhookId: existing.id,
      eventId: event.id,
      eventType: WEBHOOK_TEST_EVENT,
      payload: JSON.stringify(event),
      nextAttemptAt: null,
      createdAt: now,
    },
  ]);
  if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });

  const result = await attemptDelivery(store, job, webhookDeliveryDeps(ctx.db));
  return {
    ok: result.status === "succeeded",
    responseStatus: result.responseStatus,
    durationMs: result.durationMs,
    error: result.error,
  };
};

export const listWebhookDeliveries = async (ctx: WorkspaceTRPCContext, input: WebhookIdInput) => {
  const existing = await getOwnedWebhook(ctx, input.id);
  return ctx.db
    .select({
      id: webhookDelivery.id,
      eventType: webhookDelivery.eventType,
      status: webhookDelivery.status,
      attempts: webhookDelivery.attempts,
      responseStatus: webhookDelivery.responseStatus,
      durationMs: webhookDelivery.durationMs,
      error: webhookDelivery.error,
      nextAttemptAt: webhookDelivery.nextAttemptAt,
      lastAttemptAt: webhookDelivery.lastAttemptAt,
      createdAt: webhookDelivery.createdAt,
    })
    .from(webhookDelivery)
    .where(eq(webhookDelivery.webhookId, existing.id))
    .orderBy(desc(webhookDelivery.createdAt), desc(webhookDelivery.id))
    .limit(WEBHOOK_LOG_SIZE);
};
