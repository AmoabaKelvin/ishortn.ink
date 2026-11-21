import { describe, expect, test } from "bun:test";

import { createDeferredClient } from "@/lib/analytics/deferred-client";

import { openPaymentPage } from "./open-payment-page";

import type { flushTrackEvent } from "@/lib/analytics/events";

const URL = "https://example.lemonsqueezy.com/update";

// Stands in for PostHog: events wait in a deferred client until it "loads".
function fakePostHog(timeoutMs: number) {
  const deferred = createDeferredClient<string[]>(10);
  const track: typeof flushTrackEvent = (eventName) =>
    deferred.runWithin((sent) => sent.push(eventName), timeoutMs);
  return { deferred, track };
}

describe("openPaymentPage", () => {
  test("redirects only after the event has been captured", async () => {
    const { deferred, track } = fakePostHog(60_000);
    const log: string[] = [];

    const opening = openPaymentPage({
      url: URL,
      source: "email",
      navigate: (url) => log.push(`navigate ${url}`),
      track,
    });
    await Bun.sleep(10);
    expect(log).toEqual([]);

    deferred.ready(log);
    await opening;
    expect(log).toEqual(["payment_update_clicked", `navigate ${URL}`]);
  });

  test("redirects after the timeout when PostHog never loads", async () => {
    const { track } = fakePostHog(20);
    const log: string[] = [];

    const opening = openPaymentPage({
      url: URL,
      source: "email",
      navigate: (url) => log.push(`navigate ${url}`),
      track,
    });
    await Bun.sleep(5);
    expect(log).toEqual([]);

    await opening;
    expect(log).toEqual([`navigate ${URL}`]);
  });

  test("does not navigate without a url", async () => {
    const { deferred, track } = fakePostHog(20);
    const log: string[] = [];
    deferred.ready(log);

    await openPaymentPage({ url: null, source: null, navigate: () => log.push("navigate"), track });
    expect(log).toEqual(["payment_update_clicked"]);
  });
});
