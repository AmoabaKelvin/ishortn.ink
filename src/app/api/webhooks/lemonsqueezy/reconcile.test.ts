import { beforeEach, describe, expect, it, mock } from "bun:test";

const getSubscription = mock(async () => ({ data: null, error: null }));
mock.module("@lemonsqueezy/lemonsqueezy.js", () => ({ getSubscription }));
mock.module("@/lib/config/lemonsqueezy", () => ({ configureLemonSqueezy: () => {} }));

const { eventIsBehindProvider } = await import("./reconcile");

const providerState = (updated_at: string) => ({
  data: { data: { attributes: { updated_at } } },
  error: null,
});

describe("eventIsBehindProvider", () => {
  beforeEach(() => getSubscription.mockReset());

  it("flags an event older than the provider's current state", async () => {
    getSubscription.mockResolvedValue(providerState("2026-08-20T00:00:00Z") as never);
    expect(await eventIsBehindProvider(1, new Date("2026-08-19T00:00:00Z"))).toBe(true);
  });

  it("accepts an event that matches the provider's current state", async () => {
    getSubscription.mockResolvedValue(providerState("2026-08-20T00:00:00Z") as never);
    expect(await eventIsBehindProvider(1, new Date("2026-08-20T00:00:00Z"))).toBe(false);
  });

  it("throws when the provider cannot be reached", async () => {
    getSubscription.mockResolvedValue({ data: null, error: new Error("boom") } as never);
    await expect(eventIsBehindProvider(1, new Date())).rejects.toThrow("boom");
  });
});
