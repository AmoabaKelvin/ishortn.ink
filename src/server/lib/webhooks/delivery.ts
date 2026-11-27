import { randomBytes } from "node:crypto";

import { getWebhookEndpointLimit } from "@/lib/billing/plans";
import { checkHttpUrl, type Resolver } from "@/server/lib/ssrf";

import { signWebhookPayload, WEBHOOK_SIGNATURE_HEADER } from "./signature";

import type { Plan } from "@/lib/billing/plans";
import type { WebhookEventType } from "@/lib/webhooks";
import type { toApiLink } from "@/server/lib/api-link";

export const WEBHOOK_TEST_EVENT = "webhook.test";
export const WEBHOOK_TIMEOUT_MS = 10_000;
/** Failed deliveries are retried until this long after the event. */
export const WEBHOOK_RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Consecutive counted failures after which an endpoint is switched off. */
export const WEBHOOK_DISABLE_AFTER = 20;
/**
 * At most one failure per endpoint counts toward WEBHOOK_DISABLE_AFTER in this window, so a burst
 * of attempts from one bulk action during a brief outage can't switch the endpoint off.
 */
export const WEBHOOK_FAILURE_WINDOW_MS = 60 * 1000;
/** Deliveries shown per endpoint in the dashboard. */
export const WEBHOOK_LOG_SIZE = 50;

const FIRST_RETRY_DELAY_MS = 5 * 60 * 1000;
const MAX_RETRY_DELAY_MS = 12 * 60 * 60 * 1000;
// The first attempt runs right after the event. Its row is due this much later, so the retry
// cron only picks it up if that attempt never finished (the Worker was evicted mid-request).
const FIRST_ATTEMPT_LEASE_MS = 2 * 60 * 1000;
// Deliveries attempted right after an event; any more wait for the retry cron.
const IMMEDIATE_ATTEMPTS = 50;
const ATTEMPT_CONCURRENCY = 10;

/** Who an event belongs to: a personal workspace (teamId null) or a team. */
export type WebhookWorkspace = { userId: string; teamId: number | null };

/** `data` of an event: a link in its v1 API shape, or a verified domain. */
export type WebhookEventData =
  | ReturnType<typeof toApiLink>
  | { id: number; domain: string; verifiedAt: string };

export type WebhookEvent = {
  id: string;
  type: WebhookEventType | typeof WEBHOOK_TEST_EVENT;
  createdAt: string;
  workspace: { type: "personal"; id: string } | { type: "team"; id: number };
  data: WebhookEventData;
};

export type WebhookEndpoint = {
  id: number;
  userId: string;
  teamId: number | null;
  events: readonly string[];
  enabled: boolean;
};

/** A delivery joined with what's needed to send it. */
export type DeliveryJob = {
  id: number;
  webhookId: number;
  eventId: string;
  eventType: string;
  payload: string;
  attempts: number;
  createdAt: Date;
  url: string;
  secret: string;
  userId: string;
  teamId: number | null;
};

export type NewDelivery = {
  webhookId: number;
  eventId: string;
  eventType: string;
  payload: string;
  /** Null keeps the row out of the retry cron's reach (test events are attempted once). */
  nextAttemptAt: Date | null;
  createdAt: Date;
};

export type DeliveryUpdate = {
  status: "pending" | "succeeded" | "failed";
  attempts: number;
  responseStatus: number | null;
  durationMs: number;
  error: string | null;
  nextAttemptAt: Date | null;
  lastAttemptAt: Date;
};

/** Persistence for the delivery engine; dbWebhookStore in store.ts is the real one. */
export type WebhookStore = {
  /** The workspace's enabled endpoints. */
  listEnabledEndpoints(workspace: WebhookWorkspace): Promise<WebhookEndpoint[]>;
  /** The workspace's effective plan (a team's comes from its owner). */
  workspacePlan(workspace: WebhookWorkspace): Promise<Plan>;
  /** Inserts the rows and returns them as jobs, in order. */
  insertDeliveries(rows: NewDelivery[]): Promise<DeliveryJob[]>;
  /** Pending deliveries of enabled endpoints due by `now`, oldest first. */
  dueDeliveries(now: Date, limit: number): Promise<DeliveryJob[]>;
  saveAttempt(deliveryId: number, update: DeliveryUpdate): Promise<void>;
  /** Gives up on pending deliveries without attempting them. */
  failDeliveries(deliveryIds: number[], error: string): Promise<void>;
  resetFailures(webhookId: number): Promise<void>;
  /**
   * Counts one failed attempt, unless one was already counted within WEBHOOK_FAILURE_WINDOW_MS of
   * `now`. When the count reaches `disableAfter` on an enabled endpoint, disables it, fails its
   * pending deliveries and returns true; only that one call returns true.
   */
  recordFailure(webhookId: number, disableAfter: number, now: Date): Promise<boolean>;
};

export type DeliveryDeps = {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  now: () => Date;
  resolve?: Resolver;
  /** Told once when failures switch an endpoint off. */
  onDisabled: (webhookId: number) => Promise<void>;
};

export function newEventId(): string {
  return `evt_${randomBytes(12).toString("hex")}`;
}

export function buildWebhookEvent(
  workspace: WebhookWorkspace,
  type: WebhookEvent["type"],
  data: WebhookEventData,
  now: Date,
): WebhookEvent {
  return {
    id: newEventId(),
    type,
    createdAt: now.toISOString(),
    workspace:
      workspace.teamId === null
        ? { type: "personal", id: workspace.userId }
        : { type: "team", id: workspace.teamId },
    data,
  };
}

function sameWorkspace(endpoint: WebhookEndpoint, workspace: WebhookWorkspace): boolean {
  return workspace.teamId === null
    ? endpoint.teamId === null && endpoint.userId === workspace.userId
    : endpoint.teamId === workspace.teamId;
}

/** Endpoints that receive `type` in `workspace`: enabled, subscribed and in that workspace. */
export function subscribedEndpoints(
  endpoints: readonly WebhookEndpoint[],
  workspace: WebhookWorkspace,
  type: WebhookEventType,
): WebhookEndpoint[] {
  return endpoints.filter(
    (endpoint) =>
      endpoint.enabled && endpoint.events.includes(type) && sameWorkspace(endpoint, workspace),
  );
}

/**
 * When the attempt after `attempts` failed ones is due, or null once that would fall outside the
 * retry window. Delays grow 5 min, 15 min, 45 min, 2 h 15 min, 6 h 45 min, then 12 h, so an event
 * gets 7 attempts over about 22 hours.
 */
export function nextAttemptAt(createdAt: Date, attempts: number, now: Date): Date | null {
  const delay = Math.min(FIRST_RETRY_DELAY_MS * 3 ** (attempts - 1), MAX_RETRY_DELAY_MS);
  const next = new Date(now.getTime() + delay);
  return next.getTime() - createdAt.getTime() <= WEBHOOK_RETRY_WINDOW_MS ? next : null;
}

type AttemptResult = {
  ok: boolean;
  status: number | null;
  durationMs: number;
  error: string | null;
};

/** POSTs one signed delivery. Never throws: failures come back as the result. */
export async function sendWebhook(job: DeliveryJob, deps: DeliveryDeps): Promise<AttemptResult> {
  const started = Date.now();
  const failed = (error: string, status: number | null = null): AttemptResult => ({
    ok: false,
    status,
    durationMs: Date.now() - started,
    error,
  });

  // Checked on every attempt: the hostname may have been re-pointed since the endpoint was saved.
  if ((await checkHttpUrl(job.url, deps.resolve)) !== "public") {
    return failed("URL does not resolve to a public address");
  }

  const timestamp = Math.floor(deps.now().getTime() / 1000);
  try {
    const response = await deps.fetch(job.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "iShortn-Webhooks/1.0",
        [WEBHOOK_SIGNATURE_HEADER]: signWebhookPayload(job.secret, job.payload, timestamp),
      },
      body: job.payload,
      // A redirect would send the signed body somewhere that wasn't validated.
      redirect: "manual",
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    // Only the status matters; don't hold the connection open reading the body.
    await response.body?.cancel().catch(() => {});
    if (response.status >= 200 && response.status < 300) {
      return { ok: true, status: response.status, durationMs: Date.now() - started, error: null };
    }
    return failed(`HTTP ${response.status}`, response.status);
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return failed(`Timed out after ${WEBHOOK_TIMEOUT_MS / 1000} s`);
    }
    return failed(`Request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Makes one attempt and records it. Failures are rescheduled within the retry window and count
 * toward auto-disable; test events are sent once and don't count.
 */
export async function attemptDelivery(
  store: WebhookStore,
  job: DeliveryJob,
  deps: DeliveryDeps,
): Promise<DeliveryUpdate> {
  const result = await sendWebhook(job, deps);
  const now = deps.now();
  const attempts = job.attempts + 1;
  const isTest = job.eventType === WEBHOOK_TEST_EVENT;
  const retryAt = result.ok || isTest ? null : nextAttemptAt(job.createdAt, attempts, now);
  const update: DeliveryUpdate = {
    status: result.ok ? "succeeded" : retryAt ? "pending" : "failed",
    attempts,
    responseStatus: result.status,
    durationMs: result.durationMs,
    error: result.error?.slice(0, 255) ?? null,
    nextAttemptAt: retryAt,
    lastAttemptAt: now,
  };
  await store.saveAttempt(job.id, update);

  if (isTest) return update;
  if (result.ok) {
    await store.resetFailures(job.webhookId);
  } else if (await store.recordFailure(job.webhookId, WEBHOOK_DISABLE_AFTER, now)) {
    await deps.onDisabled(job.webhookId);
  }
  return update;
}

/** Runs `task` over `items` with at most `concurrency` in flight. */
async function eachWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await task(items[next++]!);
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

/** Error saved on deliveries dropped because their endpoint is beyond the plan's limit. */
export const WEBHOOK_OVER_LIMIT_ERROR = "Endpoint is over the plan's webhook limit";

/**
 * The enabled endpoints that may receive events on `plan`: the oldest ones up to its limit, so
 * endpoints kept past a downgrade's lower limit stay quiet.
 */
function liveEndpointIds(enabled: readonly WebhookEndpoint[], plan: Plan): Set<number> {
  return new Set(
    enabled
      .map((endpoint) => endpoint.id)
      .sort((a, b) => a - b)
      .slice(0, getWebhookEndpointLimit(plan)),
  );
}

/**
 * Records one `type` event per item for every subscribed endpoint of the workspace and makes the
 * first attempts. A bulk action (up to 100 links) can create more deliveries than one request
 * should send, so past IMMEDIATE_ATTEMPTS the rest are left due for the retry cron.
 * Returns the deliveries created.
 */
export async function dispatchWebhookEvents(
  store: WebhookStore,
  workspace: WebhookWorkspace,
  type: WebhookEventType,
  items: readonly WebhookEventData[],
  deps: DeliveryDeps,
): Promise<DeliveryJob[]> {
  if (items.length === 0) return [];
  const enabled = await store.listEnabledEndpoints(workspace);
  const subscribed = subscribedEndpoints(enabled, workspace, type);
  if (subscribed.length === 0) return [];
  // Callers skip plans without webhooks when they know the plan; this also covers the ones that
  // don't, and endpoints kept past a downgrade's lower limit.
  const live = liveEndpointIds(enabled, await store.workspacePlan(workspace));
  if (live.size === 0) return [];
  const endpoints = subscribed.filter((endpoint) => live.has(endpoint.id));

  const now = deps.now();
  const leaseUntil = new Date(now.getTime() + FIRST_ATTEMPT_LEASE_MS);
  const immediateEvents = new Set<string>();
  const rows = items.flatMap((data, index) => {
    const event = buildWebhookEvent(workspace, type, data, now);
    const payload = JSON.stringify(event);
    const immediate = index * endpoints.length < IMMEDIATE_ATTEMPTS;
    if (immediate) immediateEvents.add(event.id);
    return endpoints.map((endpoint) => ({
      webhookId: endpoint.id,
      eventId: event.id,
      eventType: type,
      payload,
      nextAttemptAt: immediate ? leaseUntil : now,
      createdAt: now,
    }));
  });
  const jobs = await store.insertDeliveries(rows);
  const immediate = jobs.filter((job) => immediateEvents.has(job.eventId));
  await eachWithConcurrency(immediate, ATTEMPT_CONCURRENCY, async (job) => {
    await attemptDelivery(store, job, deps);
  });
  return jobs;
}

/**
 * Attempts the deliveries whose retry is due; run by the webhook-retries cron. The plan may have
 * changed since the event, so deliveries of endpoints no longer within its limit are failed
 * instead of sent, as dispatchWebhookEvents would have skipped them.
 */
export async function runDueDeliveries(
  store: WebhookStore,
  deps: DeliveryDeps,
  { limit = 500 }: { limit?: number } = {},
): Promise<{ attempted: number; succeeded: number }> {
  const due = await store.dueDeliveries(deps.now(), limit);
  const byWorkspace = new Map<string, DeliveryJob[]>();
  for (const job of due) {
    const key = job.teamId === null ? `user:${job.userId}` : `team:${job.teamId}`;
    const jobs = byWorkspace.get(key);
    if (jobs) jobs.push(job);
    else byWorkspace.set(key, [job]);
  }

  // One lookup per workspace in the batch, not per delivery.
  const sendable: DeliveryJob[] = [];
  const overLimit: number[] = [];
  await Promise.all(
    [...byWorkspace.values()].map(async (jobs) => {
      const workspace = { userId: jobs[0]!.userId, teamId: jobs[0]!.teamId };
      const [enabled, plan] = await Promise.all([
        store.listEnabledEndpoints(workspace),
        store.workspacePlan(workspace),
      ]);
      const live = liveEndpointIds(enabled, plan);
      for (const job of jobs) {
        if (live.has(job.webhookId)) sendable.push(job);
        else overLimit.push(job.id);
      }
    }),
  );
  if (overLimit.length > 0) await store.failDeliveries(overLimit, WEBHOOK_OVER_LIMIT_ERROR);

  let succeeded = 0;
  await eachWithConcurrency(sendable, ATTEMPT_CONCURRENCY, async (job) => {
    const update = await attemptDelivery(store, job, deps);
    if (update.status === "succeeded") succeeded++;
  });
  return { attempted: sendable.length, succeeded };
}
