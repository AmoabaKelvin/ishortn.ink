import { describe, expect, test } from "bun:test";

import { API_RATE_LIMITS } from "@/lib/billing/plans";

import {
  applyRateLimit,
  consumeRateLimit,
  evaluateWindow,
  planRateLimitWindows,
  rateLimitedResponse,
  rateLimitHeaders,
  readRateLimitCounters,
} from "./rate-limit";

import type { CounterStore, RateLimitWindow } from "./rate-limit";

// 2026-11-20T12:00:00Z: a whole minute and a whole UTC day boundary.
const MINUTE_START = Date.UTC(2026, 10, 20, 12, 0, 0);
const DAY_END_SECONDS = Date.UTC(2026, 10, 21) / 1000;

function memoryStore(initial: Record<string, number> = {}) {
  const data = new Map(Object.entries(initial).map(([k, v]) => [k, String(v)]));
  const store: CounterStore = {
    get: async (keys) => new Map(keys.map((key) => [key, data.get(key) ?? null])),
    put: async (key, value) => {
      data.set(key, value);
    },
  };
  return { store, data };
}

let subjectCounter = 0;
// Each test gets its own subject so the limiter's per-isolate counts don't leak.
const nextSubject = () => `test-subject-${++subjectCounter}`;
const runNow = (task: Promise<unknown>) => void task;

describe("evaluateWindow", () => {
  const minute: RateLimitWindow = { limit: 10, windowSeconds: 60 };

  test("allows under the limit and reports what is left after this request", () => {
    const decision = evaluateWindow(minute, { current: 3, previous: 0 }, MINUTE_START + 1000);
    expect(decision).toEqual({
      allowed: true,
      limit: 10,
      remaining: 6,
      reset: MINUTE_START / 1000 + 60,
      retryAfter: 0,
    });
  });

  test("weights the previous window by how much of it still overlaps", () => {
    // Halfway through the window, 10 requests last minute count as 5.
    const decision = evaluateWindow(minute, { current: 4, previous: 10 }, MINUTE_START + 30_000);
    expect(decision.allowed).toBe(true);
    expect(decision.remaining).toBe(0);

    const full = evaluateWindow(minute, { current: 5, previous: 10 }, MINUTE_START + 30_000);
    expect(full.allowed).toBe(false);
  });

  test("blocked by the current window: waits for the next window to decay it", () => {
    const decision = evaluateWindow(minute, { current: 10, previous: 0 }, MINUTE_START + 20_000);
    expect(decision.allowed).toBe(false);
    expect(decision.remaining).toBe(0);
    // 40s to the boundary, then 10 * (1 - s/60) <= 9 needs s >= 6.
    expect(decision.retryAfter).toBe(46);
  });

  test("blocked by the previous window: waits until its share decays", () => {
    // used = 10 * (1 - 0) + 5 = 15; needs 10 * (1 - t/60) <= 4, so t >= 36.
    const decision = evaluateWindow(minute, { current: 5, previous: 10 }, MINUTE_START);
    expect(decision.allowed).toBe(false);
    expect(decision.retryAfter).toBe(36);
  });
});

describe("consumeRateLimit", () => {
  test("counts each accepted request and rejects once the minute limit is reached", async () => {
    const { store } = memoryStore();
    const subject = nextSubject();
    const windows: RateLimitWindow[] = [
      { limit: 3, windowSeconds: 60 },
      { limit: 100, windowSeconds: 86_400 },
    ];
    const opts = { store, defer: runNow, nowMs: MINUTE_START + 5_000 };

    const remaining: number[] = [];
    for (let i = 0; i < 3; i++) {
      const decision = await consumeRateLimit(subject, windows, opts);
      expect(decision.allowed).toBe(true);
      remaining.push(decision.remaining);
    }
    expect(remaining).toEqual([2, 1, 0]);

    const rejected = await consumeRateLimit(subject, windows, opts);
    expect(rejected).toMatchObject({ allowed: false, limit: 3, remaining: 0 });
    // 55s to the boundary, then 3 * (1 - s/60) <= 2 needs s >= 20.
    expect(rejected.retryAfter).toBe(75);
  });

  test("does not count rejected requests", async () => {
    const { store, data } = memoryStore();
    const subject = nextSubject();
    const windows: RateLimitWindow[] = [{ limit: 1, windowSeconds: 60 }];
    const opts = { store, defer: runNow, nowMs: MINUTE_START };

    await consumeRateLimit(subject, windows, opts);
    await consumeRateLimit(subject, windows, opts);
    await consumeRateLimit(subject, windows, opts);

    expect([...data.values()]).toEqual(["1"]);
  });

  test("the daily window blocks even when the minute window has room", async () => {
    const subject = nextSubject();
    const windows = planRateLimitWindows("free");
    const dayIndex = Math.floor(MINUTE_START / 1000 / 86_400);
    const { store } = memoryStore({
      [`ratelimit:api:${subject}:86400:${dayIndex}`]: API_RATE_LIMITS.free.perDay,
    });

    const decision = await consumeRateLimit(subject, windows, {
      store,
      defer: runNow,
      nowMs: MINUTE_START,
    });
    expect(decision).toMatchObject({
      allowed: false,
      limit: API_RATE_LIMITS.free.perDay,
      reset: DAY_END_SECONDS,
    });
  });

  test("a stale store read can't hide requests this isolate already accepted", async () => {
    const subject = nextSubject();
    const windows: RateLimitWindow[] = [{ limit: 2, windowSeconds: 60 }];
    // Every read misses, like KV before a write has propagated.
    const staleStore: CounterStore = { get: async () => new Map(), put: async () => undefined };
    const opts = { store: staleStore, defer: runNow, nowMs: MINUTE_START };

    expect((await consumeRateLimit(subject, windows, opts)).allowed).toBe(true);
    expect((await consumeRateLimit(subject, windows, opts)).allowed).toBe(true);
    expect((await consumeRateLimit(subject, windows, opts)).allowed).toBe(false);
  });

  test("reports the window closest to its limit while allowed", async () => {
    const subject = nextSubject();
    const minuteIndex = Math.floor(MINUTE_START / 1000 / 60);
    const dayIndex = Math.floor(MINUTE_START / 1000 / 86_400);
    const { store } = memoryStore({
      [`ratelimit:api:${subject}:60:${minuteIndex}`]: 1,
      [`ratelimit:api:${subject}:86400:${dayIndex}`]: API_RATE_LIMITS.free.perDay - 5,
    });

    const decision = await consumeRateLimit(subject, planRateLimitWindows("free"), {
      store,
      defer: runNow,
      nowMs: MINUTE_START,
    });
    expect(decision).toMatchObject({
      allowed: true,
      limit: API_RATE_LIMITS.free.perDay,
      remaining: 4,
    });
  });
});

describe("readRateLimitCounters + applyRateLimit", () => {
  test("counters read before the plan is known apply that plan's limits", async () => {
    const subject = nextSubject();
    const minuteIndex = Math.floor(MINUTE_START / 1000 / 60);
    const { store, data } = memoryStore({
      [`ratelimit:api:${subject}:60:${minuteIndex}`]: API_RATE_LIMITS.free.perMinute,
    });
    const windows = planRateLimitWindows("free");
    const counters = await readRateLimitCounters(
      subject,
      windows.map((w) => w.windowSeconds),
      { store, nowMs: MINUTE_START },
    );

    // The same stored counts block Free but leave room on Pro.
    expect(applyRateLimit(counters, windows, { store, defer: runNow }).allowed).toBe(false);
    const pro = applyRateLimit(counters, planRateLimitWindows("pro"), { store, defer: runNow });
    expect(pro).toMatchObject({
      allowed: true,
      limit: API_RATE_LIMITS.pro.perMinute,
      remaining: API_RATE_LIMITS.pro.perMinute - API_RATE_LIMITS.free.perMinute - 1,
    });
    expect(data.get(`ratelimit:api:${subject}:60:${minuteIndex}`)).toBe(
      String(API_RATE_LIMITS.free.perMinute + 1),
    );
  });
});

describe("rate limit responses", () => {
  const blocked = { allowed: false, limit: 60, remaining: 0, reset: 1_795_000_000, retryAfter: 12 };

  test("429 carries Retry-After and the X-RateLimit headers", async () => {
    const response = rateLimitedResponse(blocked);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("12");
    expect(response.headers.get("X-RateLimit-Limit")).toBe("60");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(response.headers.get("X-RateLimit-Reset")).toBe("1795000000");
    expect(await response.json()).toEqual({
      error: {
        code: "rate_limited",
        message: "Rate limit exceeded. Retry in 12 seconds.",
        details: [],
      },
    });
  });

  test("allowed responses get the headers without Retry-After", () => {
    expect(rateLimitHeaders({ ...blocked, allowed: true, remaining: 7, retryAfter: 0 })).toEqual({
      "X-RateLimit-Limit": "60",
      "X-RateLimit-Remaining": "7",
      "X-RateLimit-Reset": "1795000000",
    });
  });

  test("every plan has a minute and a daily limit", () => {
    for (const limits of Object.values(API_RATE_LIMITS)) {
      expect(limits.perMinute).toBeGreaterThan(0);
      expect(limits.perDay).toBeGreaterThan(limits.perMinute);
    }
  });
});
