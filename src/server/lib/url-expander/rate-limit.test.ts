import { describe, expect, it } from "bun:test";

import { consumeExpanderRateLimit, rateLimitMessage } from "./rate-limit";

import type { CounterStore } from "@/app/api/v1/rate-limit";

const memoryStore = (): CounterStore => {
  const values = new Map<string, string>();
  return {
    get: async (keys) => new Map(keys.map((key) => [key, values.get(key) ?? null])),
    put: async (key, value) => {
      values.set(key, value);
    },
  };
};

describe("URL expander rate limit", () => {
  it("allows 20 lookups per IP in 10 minutes, then refuses", async () => {
    const store = memoryStore();
    const pending: Promise<unknown>[] = [];
    const options = {
      store,
      defer: (task: Promise<unknown>) => void pending.push(task),
      // The start of a window, so the previous window carries no weight.
      nowMs: 600_000 * 4_000_000,
    };
    // A unique subject: the limiter also keeps per-isolate counts.
    const ip = `ip-${crypto.randomUUID()}`;

    for (let i = 0; i < 20; i++) {
      expect((await consumeExpanderRateLimit(ip, options)).allowed).toBe(true);
      await Promise.all(pending);
    }
    const blocked = await consumeExpanderRateLimit(ip, options);
    expect(blocked.allowed).toBe(false);
    expect(rateLimitMessage(blocked.retryAfter)).toStartWith(
      "You've expanded 20 links in the last 10 minutes. Try again in",
    );

    expect((await consumeExpanderRateLimit(`other-${ip}`, options)).allowed).toBe(true);
  });

  it("words the wait in whole minutes", () => {
    expect(rateLimitMessage(30)).toEndWith("Try again in 1 minute.");
    expect(rateLimitMessage(301)).toEndWith("Try again in 6 minutes.");
  });
});
