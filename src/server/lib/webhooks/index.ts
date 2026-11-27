import { getWebhookEndpointLimit } from "@/lib/billing/plans";
import { logger } from "@/lib/logger";
import { runBackgroundTask } from "@/lib/utils/background";
import { toApiLink } from "@/server/lib/api-link";
import { sendWebhookDisabledEmail } from "@/server/lib/notifications/webhook-disabled";

import {
  dispatchWebhookEvents,
  type DeliveryDeps,
  type WebhookEventData,
  type WebhookWorkspace,
} from "./delivery";
import { dbWebhookStore } from "./store";

export { webhookWorkspacePlan } from "./store";

import type { Plan } from "@/lib/billing/plans";
import type { WebhookEventType } from "@/lib/webhooks";
import type { db as appDb } from "@/server/db";
import type { WorkspaceContext } from "@/server/lib/workspace";

const log = logger.child({ component: "webhooks" });

type Db = typeof appDb;

export function webhookDeliveryDeps(db: Db): DeliveryDeps {
  return {
    fetch: (url, init) => fetch(url, init),
    now: () => new Date(),
    onDisabled: (webhookId) =>
      sendWebhookDisabledEmail(db, webhookId).catch((err) => {
        log.error({ err, webhookId }, "failed to send webhook disabled email");
      }),
  };
}

/**
 * Sends one `type` event per item to the workspace's subscribed endpoints after the response, so
 * neither the endpoint lookup nor the deliveries add latency to the request that caused them.
 * `plan`, when known, skips the lookup for plans without webhooks.
 */
export function emitWebhookEvents(
  db: Db,
  workspace: WebhookWorkspace & { plan?: Plan },
  type: WebhookEventType,
  items: readonly WebhookEventData[],
): void {
  if (items.length === 0) return;
  if (workspace.plan && getWebhookEndpointLimit(workspace.plan) === 0) return;
  const target = { userId: workspace.userId, teamId: workspace.teamId };
  const task = dispatchWebhookEvents(
    dbWebhookStore(db),
    target,
    type,
    items,
    webhookDeliveryDeps(db),
  ).catch((err) => {
    log.error({ err, type, ...target }, "webhook dispatch failed");
  });
  // Off-platform (tests, scripts) there is no waitUntil; the task still runs.
  void runBackgroundTask(task).catch(() => undefined);
}

type LinkForWebhook = Parameters<typeof toApiLink>[0];

/** emitWebhookEvents for link events, with each link in its v1 API shape. */
export function emitLinkWebhooks(
  db: Db,
  workspace: WorkspaceContext,
  type: "link.created" | "link.updated" | "link.deleted",
  links: readonly LinkForWebhook[],
): void {
  emitWebhookEvents(
    db,
    { userId: workspace.userId, teamId: workspace.teamId, plan: workspace.plan },
    type,
    links.map(toApiLink),
  );
}

/** emitWebhookEvents for a custom domain that just went live. */
export function emitDomainVerified(
  db: Db,
  workspace: WebhookWorkspace & { plan?: Plan },
  domain: { id: number; domain: string },
): void {
  emitWebhookEvents(db, workspace, "domain.verified", [
    { id: domain.id, domain: domain.domain, verifiedAt: new Date().toISOString() },
  ]);
}
