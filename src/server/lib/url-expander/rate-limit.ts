import { consumeRateLimit } from "@/app/api/v1/rate-limit";

import type { CounterStore, RateLimitDecision } from "@/app/api/v1/rate-limit";

export const EXPANDER_RATE_LIMIT = { limit: 20, windowSeconds: 10 * 60 };

/** Counts one lookup for a visitor (by hashed IP); rejected lookups aren't counted. */
export function consumeExpanderRateLimit(
  ipHash: string,
  options: { store?: CounterStore; defer?: (task: Promise<unknown>) => void; nowMs?: number } = {},
): Promise<RateLimitDecision> {
  return consumeRateLimit(`url-expander:${ipHash}`, [EXPANDER_RATE_LIMIT], options);
}

export const rateLimitMessage = (retryAfterSeconds: number) => {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `You've expanded ${EXPANDER_RATE_LIMIT.limit} links in the last 10 minutes. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
};
