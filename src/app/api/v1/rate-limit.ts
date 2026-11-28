import { getApiRateLimits } from "@/lib/billing/plans";
import { getStringsFromCache, setStringInCache } from "@/lib/core/cache";
import { runBackgroundTask } from "@/lib/utils/background";

import { apiError } from "./errors";

import type { Plan } from "@/lib/billing/plans";

export type RateLimitWindow = { limit: number; windowSeconds: number };

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix time (seconds) at which the reported window rolls over. */
  reset: number;
  /** Seconds until a request would be accepted again; 0 when allowed. */
  retryAfter: number;
};

export type CounterStore = {
  get: (keys: string[]) => Promise<Map<string, string | null>>;
  put: (key: string, value: string, ttlSeconds: number) => Promise<boolean | void>;
};

const kvStore: CounterStore = { get: getStringsFromCache, put: setStringInCache };

// KV is eventually consistent and accepts about one write per second per key,
// so a burst of concurrent requests would mostly read the same stale count.
// Counting in the isolate as well keeps a burst (which tends to land on the
// same isolate) from slipping through; the larger of the two counts wins.
const localCounts = new Map<string, number>();
const LOCAL_COUNTS_MAX = 5000;

export function windowKeys(
  subject: string,
  window: Pick<RateLimitWindow, "windowSeconds">,
  nowMs: number,
) {
  const index = Math.floor(nowMs / 1000 / window.windowSeconds);
  const prefix = `ratelimit:api:${subject}:${window.windowSeconds}`;
  return { current: `${prefix}:${index}`, previous: `${prefix}:${index - 1}` };
}

/**
 * Sliding-window approximation: the previous fixed window's count is weighted
 * by how much of it still overlaps the trailing window, plus the current count.
 */
export function evaluateWindow(
  window: RateLimitWindow,
  counts: { current: number; previous: number },
  nowMs: number,
): RateLimitDecision {
  const { limit, windowSeconds: w } = window;
  const nowSeconds = nowMs / 1000;
  const windowStart = Math.floor(nowSeconds / w) * w;
  const elapsed = nowSeconds - windowStart;
  const used = counts.previous * (1 - elapsed / w) + counts.current;
  const reset = windowStart + w;

  if (used + 1 <= limit) {
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, Math.floor(limit - used - 1)),
      reset,
      retryAfter: 0,
    };
  }

  // Earliest time the weighted count drops to limit - 1, assuming no more
  // accepted requests: either the previous window's share decays enough within
  // this window, or (when this window alone is over) the next window has to
  // decay this window's count.
  const target = limit - 1;
  const wait =
    counts.current <= target
      ? w * (1 - (target - counts.current) / counts.previous) - elapsed
      : w - elapsed + w * (1 - target / counts.current);

  return {
    allowed: false,
    limit,
    remaining: 0,
    reset,
    retryAfter: Math.max(1, Math.ceil(wait)),
  };
}

/** Reports the blocking window with the longest wait, else the one closest to its limit. */
export function pickDecision(decisions: RateLimitDecision[]): RateLimitDecision {
  const blocked = decisions.filter((decision) => !decision.allowed);
  if (blocked.length) {
    return blocked.reduce((a, b) => (b.retryAfter > a.retryAfter ? b : a));
  }
  return decisions.reduce((a, b) => (b.remaining < a.remaining ? b : a));
}

// Every plan counts over the same windows; only the limits differ. So the counters can be read
// as soon as the user id is known, before the plan is resolved.
const MINUTE_SECONDS = 60;
const DAY_SECONDS = 60 * 60 * 24;
const API_WINDOW_SECONDS = [MINUTE_SECONDS, DAY_SECONDS];

export function planRateLimitWindows(plan: Plan): RateLimitWindow[] {
  const limits = getApiRateLimits(plan);
  return [
    { limit: limits.perMinute, windowSeconds: MINUTE_SECONDS },
    { limit: limits.perDay, windowSeconds: DAY_SECONDS },
  ];
}

/** The stored counts of one subject's windows at `nowMs`, read before the limits are known. */
export type RateLimitCounters = {
  subject: string;
  nowMs: number;
  stored: Map<string, string | null>;
};

export async function readRateLimitCounters(
  subject: string,
  windowSeconds: number[],
  { store = kvStore, nowMs = Date.now() }: { store?: CounterStore; nowMs?: number } = {},
): Promise<RateLimitCounters> {
  const keys = windowSeconds.flatMap((seconds) => {
    const k = windowKeys(subject, { windowSeconds: seconds }, nowMs);
    return [k.current, k.previous];
  });
  return { subject, nowMs, stored: await store.get(keys) };
}

/**
 * Counts one request against every window and returns the decision. Rejected
 * requests are not counted. Best effort: when KV is unavailable only the
 * isolate's own counts apply. `counters` must cover the same window lengths.
 */
export function applyRateLimit(
  { subject, nowMs, stored }: RateLimitCounters,
  windows: RateLimitWindow[],
  {
    store = kvStore,
    defer = (task: Promise<unknown>) => {
      void runBackgroundTask(task).catch(() => undefined);
    },
  }: {
    store?: CounterStore;
    defer?: (task: Promise<unknown>) => void;
  } = {},
): RateLimitDecision {
  const keys = windows.map((window) => windowKeys(subject, window, nowMs));
  const countOf = (key: string) =>
    Math.max(Number(stored.get(key)) || 0, localCounts.get(key) ?? 0);

  const counts = keys.map((k) => ({ current: countOf(k.current), previous: countOf(k.previous) }));
  const decisions = windows.map((window, i) => evaluateWindow(window, counts[i]!, nowMs));
  const decision = pickDecision(decisions);
  if (!decision.allowed) return decision;

  if (localCounts.size > LOCAL_COUNTS_MAX) localCounts.clear();
  const writes = keys.map((k, i) => {
    const next = counts[i]!.current + 1;
    localCounts.set(k.current, next);
    // Kept for two windows so it can still be read as the previous window.
    return store.put(k.current, String(next), windows[i]!.windowSeconds * 2);
  });
  defer(Promise.all(writes));

  return decision;
}

export async function consumeRateLimit(
  subject: string,
  windows: RateLimitWindow[],
  options: {
    store?: CounterStore;
    defer?: (task: Promise<unknown>) => void;
    nowMs?: number;
  } = {},
): Promise<RateLimitDecision> {
  const counters = await readRateLimitCounters(
    subject,
    windows.map((window) => window.windowSeconds),
    options,
  );
  return applyRateLimit(counters, windows, options);
}

export function readApiRateLimitCounters(userId: string) {
  return readRateLimitCounters(userId, API_WINDOW_SECONDS);
}

export function applyApiRateLimit(counters: RateLimitCounters, plan: Plan) {
  return applyRateLimit(counters, planRateLimitWindows(plan));
}

export function rateLimitHeaders(decision: RateLimitDecision) {
  return {
    "X-RateLimit-Limit": String(decision.limit),
    "X-RateLimit-Remaining": String(decision.remaining),
    "X-RateLimit-Reset": String(decision.reset),
  };
}

export function rateLimitedResponse(decision: RateLimitDecision): Response {
  return apiError(
    429,
    "rate_limited",
    `Rate limit exceeded. Retry in ${decision.retryAfter} seconds.`,
    { headers: { ...rateLimitHeaders(decision), "Retry-After": String(decision.retryAfter) } },
  );
}
