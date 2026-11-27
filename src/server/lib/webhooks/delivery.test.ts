import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";

import { toApiLink } from "@/server/lib/api-link";

import {
  attemptDelivery,
  dispatchWebhookEvents,
  nextAttemptAt,
  runDueDeliveries,
  WEBHOOK_DISABLE_AFTER,
  WEBHOOK_FAILURE_WINDOW_MS,
  WEBHOOK_RETRY_WINDOW_MS,
  WEBHOOK_TEST_EVENT,
  type DeliveryDeps,
  type DeliveryJob,
  type DeliveryUpdate,
  type NewDelivery,
  type WebhookEndpoint,
  type WebhookStore,
} from "./delivery";

import type { Plan } from "@/lib/billing/plans";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

type StoredEndpoint = WebhookEndpoint & {
  url: string;
  secret: string;
  consecutiveFailures: number;
  lastFailureAt?: Date;
};
type StoredDelivery = NewDelivery & Partial<DeliveryUpdate> & { id: number; attempts: number };

/** In-memory WebhookStore with the semantics of dbWebhookStore. */
function memoryStore(endpoints: StoredEndpoint[], plan: Plan = "ultra") {
  const deliveries: StoredDelivery[] = [];
  const toJob = (delivery: StoredDelivery): DeliveryJob => {
    const endpoint = endpoints.find((e) => e.id === delivery.webhookId)!;
    return {
      id: delivery.id,
      webhookId: delivery.webhookId,
      eventId: delivery.eventId,
      eventType: delivery.eventType,
      payload: delivery.payload,
      attempts: delivery.attempts,
      createdAt: delivery.createdAt,
      url: endpoint.url,
      secret: endpoint.secret,
    };
  };
  const store: WebhookStore = {
    listEnabledEndpoints: async (workspace) =>
      endpoints.filter(
        (e) =>
          e.enabled &&
          (workspace.teamId === null
            ? e.teamId === null && e.userId === workspace.userId
            : e.teamId === workspace.teamId),
      ),
    workspacePlan: async () => plan,
    insertDeliveries: async (rows) =>
      rows.map((row) => {
        const delivery = {
          ...row,
          id: deliveries.length + 1,
          attempts: 0,
          status: "pending" as const,
        };
        deliveries.push(delivery);
        return toJob(delivery);
      }),
    dueDeliveries: async (now, limit) =>
      deliveries
        .filter(
          (d) =>
            d.status === "pending" &&
            d.nextAttemptAt !== null &&
            d.nextAttemptAt!.getTime() <= now.getTime() &&
            endpoints.find((e) => e.id === d.webhookId)?.enabled,
        )
        .sort((a, b) => a.nextAttemptAt!.getTime() - b.nextAttemptAt!.getTime())
        .slice(0, limit)
        .map(toJob),
    saveAttempt: async (id, update) => {
      Object.assign(
        deliveries.find((d) => d.id === id)!,
        update,
      );
    },
    resetFailures: async (webhookId) => {
      Object.assign(
        endpoints.find((e) => e.id === webhookId)!,
        {
          consecutiveFailures: 0,
          lastFailureAt: undefined,
        },
      );
    },
    recordFailure: async (webhookId, disableAfter, now) => {
      const endpoint = endpoints.find((e) => e.id === webhookId)!;
      const last = endpoint.lastFailureAt?.getTime();
      if (last !== undefined && now.getTime() - last < WEBHOOK_FAILURE_WINDOW_MS) return false;
      endpoint.consecutiveFailures++;
      endpoint.lastFailureAt = now;
      if (!endpoint.enabled || endpoint.consecutiveFailures < disableAfter) return false;
      endpoint.enabled = false;
      for (const d of deliveries) {
        if (d.webhookId === webhookId && d.status === "pending") {
          Object.assign(d, { status: "failed", nextAttemptAt: null });
        }
      }
      return true;
    },
  };
  return { store, deliveries, endpoints };
}

function endpoint(
  id: number,
  overrides: Partial<StoredEndpoint> & Pick<StoredEndpoint, "userId" | "teamId">,
): StoredEndpoint {
  return {
    id,
    events: ["link.created", "link.updated", "link.deleted", "domain.verified"],
    enabled: true,
    url: `https://hooks${id}.example.com/in`,
    secret: `whsec_${id}`,
    consecutiveFailures: 0,
    ...overrides,
  };
}

type Sent = { url: string; init: RequestInit };

/** Deps with a controllable clock and an endpoint that answers `status`. */
function fakeDeps(status: (url: string) => number = () => 200) {
  let now = new Date("2026-11-27T12:00:00Z");
  const sent: Sent[] = [];
  const disabled: number[] = [];
  const deps: DeliveryDeps = {
    now: () => now,
    // Every test hostname resolves to a public address.
    resolve: async () => ["93.184.216.34"],
    fetch: async (url, init) => {
      sent.push({ url, init });
      return new Response(null, { status: status(url) });
    },
    onDisabled: async (webhookId) => void disabled.push(webhookId),
  };
  return {
    deps,
    sent,
    disabled,
    advance: (ms: number) => (now = new Date(now.getTime() + ms)),
    now: () => now,
  };
}

const sampleLink = {
  id: 7,
  createdAt: new Date("2026-11-27T11:59:00Z"),
  domain: "isht.app",
  alias: "launch",
  url: "https://example.com/launch",
  disableLinkAfterDate: null,
  activateAt: null,
  disableLinkAfterClicks: null,
};

const link = toApiLink(sampleLink);

const personal = { userId: "user_a", teamId: null };
const team = { userId: "user_a", teamId: 42 };

describe("dispatchWebhookEvents", () => {
  test.each(["link.created", "link.updated", "link.deleted"] as const)(
    "%s goes once to each subscribed endpoint of the workspace and nowhere else",
    async (type) => {
      const { store, deliveries } = memoryStore([
        endpoint(1, { ...personal }),
        endpoint(2, { ...personal, events: [type] }),
        endpoint(3, { ...personal, events: ["domain.verified"] }), // not subscribed
        endpoint(4, { ...personal, enabled: false }), // switched off
        endpoint(5, { userId: "user_a", teamId: 42 }), // same user's team
        endpoint(6, { userId: "user_b", teamId: null }), // someone else
      ]);
      const { deps, sent } = fakeDeps();

      await dispatchWebhookEvents(store, personal, type, [link], deps);

      expect(deliveries.map((d) => d.webhookId)).toEqual([1, 2]);
      expect(sent.map((s) => s.url)).toEqual([
        "https://hooks1.example.com/in",
        "https://hooks2.example.com/in",
      ]);
      expect(new Set(deliveries.map((d) => d.eventId)).size).toBe(1);
      expect(deliveries.every((d) => d.status === "succeeded" && d.attempts === 1)).toBe(true);
    },
  );

  test("team events go only to that team's endpoints", async () => {
    const { store, deliveries } = memoryStore([
      endpoint(1, { ...personal }),
      endpoint(2, { userId: "user_a", teamId: 42 }),
      endpoint(3, { userId: "user_c", teamId: 42 }), // added by another admin of the team
      endpoint(4, { userId: "user_a", teamId: 99 }),
    ]);
    const { deps } = fakeDeps();

    await dispatchWebhookEvents(store, team, "link.created", [link], deps);

    expect(deliveries.map((d) => d.webhookId)).toEqual([2, 3]);
  });

  test("sends nothing on a plan without webhooks", async () => {
    const { store, deliveries } = memoryStore([endpoint(1, { ...personal })], "free");
    const { deps, sent } = fakeDeps();

    expect(await dispatchWebhookEvents(store, personal, "link.created", [link], deps)).toEqual([]);
    expect(deliveries).toEqual([]);
    expect(sent).toEqual([]);
  });

  test("past the plan's endpoint limit only the oldest endpoints receive events", async () => {
    const { store, deliveries } = memoryStore(
      [
        endpoint(4, { ...personal }),
        endpoint(1, { ...personal, events: ["link.deleted"] }),
        endpoint(2, { ...personal }),
        endpoint(3, { ...personal }),
      ],
      "pro",
    );
    const { deps } = fakeDeps();

    await dispatchWebhookEvents(store, personal, "link.created", [link], deps);

    // Pro allows 3: endpoints 1-3 are live (1 isn't subscribed), 4 is over the limit.
    expect(deliveries.map((d) => d.webhookId)).toEqual([2, 3]);
  });

  test("creates nothing when no endpoint is subscribed", async () => {
    const { store, deliveries } = memoryStore([
      endpoint(1, { ...personal, events: ["link.deleted"] }),
    ]);
    const { deps, sent } = fakeDeps();

    expect(await dispatchWebhookEvents(store, personal, "link.created", [link], deps)).toEqual([]);
    expect(deliveries).toEqual([]);
    expect(sent).toEqual([]);
  });

  test("sends the documented envelope, signed over the exact body", async () => {
    const { store } = memoryStore([endpoint(1, { ...team })]);
    const { deps, sent, now } = fakeDeps();

    await dispatchWebhookEvents(store, team, "link.updated", [link], deps);

    const [request] = sent;
    const body = String(request!.init.body);
    expect(JSON.parse(body)).toEqual({
      id: expect.stringMatching(/^evt_[0-9a-f]{24}$/),
      type: "link.updated",
      createdAt: now().toISOString(),
      workspace: { type: "team", id: 42 },
      data: JSON.parse(JSON.stringify(toApiLink(sampleLink))),
    });
    const headers = new Headers(request!.init.headers);
    const t = Math.floor(now().getTime() / 1000);
    const digest = createHmac("sha256", "whsec_1").update(`${t}.${body}`).digest("hex");
    expect(headers.get("X-iShortn-Signature")).toBe(`t=${t},v1=${digest}`);
    expect(headers.get("content-type")).toBe("application/json");
    expect(request!.init.redirect).toBe("manual");
  });

  test("a bulk event attempts the first 50 deliveries now and leaves the rest due", async () => {
    const { store, deliveries } = memoryStore([endpoint(1, { ...personal })]);
    const { deps, sent } = fakeDeps();
    const links = Array.from({ length: 80 }, (_, i) => toApiLink({ ...sampleLink, id: i + 1 }));

    await dispatchWebhookEvents(store, personal, "link.deleted", links, deps);

    expect(deliveries).toHaveLength(80);
    expect(sent).toHaveLength(50);
    expect(await runDueDeliveries(store, deps)).toEqual({ attempted: 30, succeeded: 30 });
    expect(deliveries.every((d) => d.status === "succeeded")).toBe(true);
  });
});

describe("retries", () => {
  test("backoff grows and stops inside the 24 hour window", () => {
    const created = new Date("2026-11-27T00:00:00Z");
    const delays: number[] = [];
    let at = created;
    for (let attempts = 1; ; attempts++) {
      const next = nextAttemptAt(created, attempts, at);
      if (!next) break;
      delays.push((next.getTime() - at.getTime()) / MINUTE);
      at = next;
    }
    expect(delays).toEqual([5, 15, 45, 135, 405, 720]);
    expect(at.getTime() - created.getTime()).toBeLessThanOrEqual(WEBHOOK_RETRY_WINDOW_MS);
  });

  test("a failing endpoint is retried on the cron with backoff, then given up on", async () => {
    const { store, deliveries } = memoryStore([endpoint(1, { ...personal })]);
    const { deps, sent, advance, now } = fakeDeps(() => 503);
    const start = now().getTime();

    await dispatchWebhookEvents(store, personal, "link.created", [link], deps);
    // The retry cron runs every 15 minutes; run it for 26 hours.
    for (let tick = 0; tick < 26 * 4; tick++) {
      advance(15 * MINUTE);
      await runDueDeliveries(store, deps);
    }

    const [delivery] = deliveries;
    expect(delivery).toMatchObject({
      status: "failed",
      attempts: 7,
      responseStatus: 503,
      error: "HTTP 503",
      nextAttemptAt: null,
    });
    expect(sent).toHaveLength(7);
    expect(delivery!.lastAttemptAt!.getTime() - start).toBeLessThanOrEqual(WEBHOOK_RETRY_WINDOW_MS);
  });

  test("a retry that succeeds stops the retries and resets the failure count", async () => {
    let failing = true;
    const { store, deliveries, endpoints } = memoryStore([endpoint(1, { ...personal })]);
    const { deps, advance } = fakeDeps(() => (failing ? 500 : 204));

    await dispatchWebhookEvents(store, personal, "link.created", [link], deps);
    expect(endpoints[0]!.consecutiveFailures).toBe(1);
    failing = false;
    advance(5 * MINUTE);
    await runDueDeliveries(store, deps);

    expect(deliveries[0]).toMatchObject({ status: "succeeded", attempts: 2, responseStatus: 204 });
    expect(endpoints[0]!.consecutiveFailures).toBe(0);
  });

  test("redirects, network errors and private addresses count as failures", async () => {
    const { store, deliveries } = memoryStore([endpoint(1, { ...personal })]);
    const redirect = fakeDeps(() => 302);
    await dispatchWebhookEvents(store, personal, "link.created", [link], redirect.deps);
    expect(deliveries[0]).toMatchObject({ status: "pending", error: "HTTP 302" });

    const offline = fakeDeps();
    offline.deps.fetch = async () => {
      throw new TypeError("fetch failed");
    };
    await dispatchWebhookEvents(store, personal, "link.created", [link], offline.deps);
    expect(deliveries[1]).toMatchObject({
      status: "pending",
      error: "Request failed: fetch failed",
    });

    const rebound = fakeDeps();
    rebound.deps.resolve = async () => ["10.0.0.5"];
    await dispatchWebhookEvents(store, personal, "link.created", [link], rebound.deps);
    expect(rebound.sent).toEqual([]);
    expect(deliveries[2]).toMatchObject({ error: "URL does not resolve to a public address" });
  });
});

describe("auto-disable", () => {
  test(`switches an endpoint off after ${WEBHOOK_DISABLE_AFTER} failures in a row, once`, async () => {
    const { store, deliveries, endpoints } = memoryStore([
      endpoint(1, { ...personal }),
      endpoint(2, { ...personal }),
    ]);
    const { deps, disabled, advance } = fakeDeps((url) => (url.includes("hooks1") ? 500 : 200));

    for (let i = 0; i < WEBHOOK_DISABLE_AFTER - 1; i++) {
      await dispatchWebhookEvents(store, personal, "link.created", [link], deps);
      advance(MINUTE);
    }
    expect(endpoints[0]!.enabled).toBe(true);
    expect(disabled).toEqual([]);

    await dispatchWebhookEvents(store, personal, "link.created", [link], deps);
    expect(endpoints[0]!.enabled).toBe(false);
    expect(endpoints[1]!.enabled).toBe(true);
    expect(disabled).toEqual([1]);
    // Its queued retries are dropped rather than resumed later.
    expect(deliveries.filter((d) => d.webhookId === 1 && d.status === "pending")).toEqual([]);

    // Further events and cron runs neither reach it nor notify again.
    await dispatchWebhookEvents(store, personal, "link.created", [link], deps);
    advance(HOUR);
    await runDueDeliveries(store, deps);
    expect(disabled).toEqual([1]);
    expect(deliveries.filter((d) => d.webhookId === 1)).toHaveLength(WEBHOOK_DISABLE_AFTER);
  });

  test("a success in between starts the count over", async () => {
    let status = 500;
    const { store, endpoints } = memoryStore([endpoint(1, { ...personal })]);
    const { deps, disabled, advance } = fakeDeps(() => status);

    for (let i = 0; i < WEBHOOK_DISABLE_AFTER - 1; i++) {
      await dispatchWebhookEvents(store, personal, "link.created", [link], deps);
      advance(MINUTE);
    }
    expect(endpoints[0]!.consecutiveFailures).toBe(WEBHOOK_DISABLE_AFTER - 1);
    status = 200;
    await dispatchWebhookEvents(store, personal, "link.created", [link], deps);
    status = 500;
    await dispatchWebhookEvents(store, personal, "link.created", [link], deps);

    expect(endpoints[0]).toMatchObject({ enabled: true, consecutiveFailures: 1 });
    expect(disabled).toEqual([]);
  });

  test("a burst of failures from one bulk action counts once and keeps retrying", async () => {
    let status = 503;
    const { store, deliveries, endpoints } = memoryStore([endpoint(1, { ...personal })]);
    const { deps, sent, disabled, advance } = fakeDeps(() => status);
    const links = Array.from({ length: 100 }, (_, i) => toApiLink({ ...sampleLink, id: i + 1 }));

    // A bulk delete while the receiver is briefly down: 50 immediate attempts fail together.
    await dispatchWebhookEvents(store, personal, "link.deleted", links, deps);
    expect(sent).toHaveLength(50);
    expect(endpoints[0]).toMatchObject({ enabled: true, consecutiveFailures: 1 });
    expect(disabled).toEqual([]);

    // The rest go out on the next cron run, still failing: one more counted failure, not 50.
    advance(MINUTE);
    await runDueDeliveries(store, deps);
    expect(endpoints[0]).toMatchObject({ enabled: true, consecutiveFailures: 2 });

    // The receiver recovers and the retries deliver every event.
    status = 200;
    advance(HOUR);
    await runDueDeliveries(store, deps);
    expect(deliveries.every((d) => d.status === "succeeded")).toBe(true);
    expect(endpoints[0]).toMatchObject({ enabled: true, consecutiveFailures: 0 });
    expect(disabled).toEqual([]);
  });

  test("test events are sent once and don't count toward disabling", async () => {
    const { store, endpoints } = memoryStore([
      endpoint(1, { ...personal, consecutiveFailures: WEBHOOK_DISABLE_AFTER - 1 }),
    ]);
    const { deps, now } = fakeDeps(() => 500);
    const [job] = await store.insertDeliveries([
      {
        webhookId: 1,
        eventId: "evt_test",
        eventType: WEBHOOK_TEST_EVENT,
        payload: "{}",
        nextAttemptAt: now(),
        createdAt: now(),
      },
    ]);

    const update = await attemptDelivery(store, job!, deps);

    expect(update).toMatchObject({ status: "failed", nextAttemptAt: null, responseStatus: 500 });
    expect(endpoints[0]).toMatchObject({ enabled: true });
  });
});
