import { and, asc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";

import { webhook, webhookDelivery } from "@/server/db/schema";

import type { WebhookStore, WebhookWorkspace } from "./delivery";
import type { db as appDb } from "@/server/db";

type Db = typeof appDb;

/**
 * The workspace filter for callers that only know the owner (the domain reminder cron), with the
 * same semantics as workspaceFilter: team rows by teamId, personal rows by userId with no team.
 */
export function webhookWorkspaceFilter(workspace: WebhookWorkspace) {
  return workspace.teamId === null
    ? and(eq(webhook.userId, workspace.userId), isNull(webhook.teamId))
    : eq(webhook.teamId, workspace.teamId);
}

const jobColumns = {
  id: webhookDelivery.id,
  webhookId: webhookDelivery.webhookId,
  eventId: webhookDelivery.eventId,
  eventType: webhookDelivery.eventType,
  payload: webhookDelivery.payload,
  attempts: webhookDelivery.attempts,
  createdAt: webhookDelivery.createdAt,
  url: webhook.url,
  secret: webhook.secret,
};

export function dbWebhookStore(db: Db): WebhookStore {
  return {
    listEnabledEndpoints: (workspace) =>
      db
        .select({
          id: webhook.id,
          userId: webhook.userId,
          teamId: webhook.teamId,
          events: webhook.events,
          enabled: webhook.enabled,
        })
        .from(webhook)
        .where(and(webhookWorkspaceFilter(workspace), eq(webhook.enabled, true))),

    insertDeliveries: async (rows) => {
      if (rows.length === 0) return [];
      await db.insert(webhookDelivery).values(rows);
      // Read back by event id rather than counting on consecutive auto-increment ids.
      const eventIds = [...new Set(rows.map((row) => row.eventId))];
      return db
        .select(jobColumns)
        .from(webhookDelivery)
        .innerJoin(webhook, eq(webhook.id, webhookDelivery.webhookId))
        .where(inArray(webhookDelivery.eventId, eventIds))
        .orderBy(asc(webhookDelivery.id));
    },

    dueDeliveries: (now, limit) =>
      db
        .select(jobColumns)
        .from(webhookDelivery)
        .innerJoin(webhook, eq(webhook.id, webhookDelivery.webhookId))
        .where(
          and(
            eq(webhookDelivery.status, "pending"),
            lte(webhookDelivery.nextAttemptAt, now),
            eq(webhook.enabled, true),
          ),
        )
        .orderBy(asc(webhookDelivery.nextAttemptAt))
        .limit(limit),

    saveAttempt: async (deliveryId, update) => {
      await db.update(webhookDelivery).set(update).where(eq(webhookDelivery.id, deliveryId));
    },

    resetFailures: async (webhookId) => {
      await db.update(webhook).set({ consecutiveFailures: 0 }).where(eq(webhook.id, webhookId));
    },

    recordFailure: async (webhookId, disableAfter, now) => {
      await db
        .update(webhook)
        .set({ consecutiveFailures: sql`${webhook.consecutiveFailures} + 1` })
        .where(eq(webhook.id, webhookId));
      // Conditional on `enabled`, so of concurrent failures only one disables and notifies.
      const [disabled] = await db
        .update(webhook)
        .set({ enabled: false, disabledAt: now })
        .where(
          and(
            eq(webhook.id, webhookId),
            eq(webhook.enabled, true),
            gte(webhook.consecutiveFailures, disableAfter),
          ),
        );
      if (disabled.affectedRows === 0) return false;
      await db
        .update(webhookDelivery)
        .set({ status: "failed", nextAttemptAt: null })
        .where(
          and(eq(webhookDelivery.webhookId, webhookId), eq(webhookDelivery.status, "pending")),
        );
      return true;
    },
  };
}
