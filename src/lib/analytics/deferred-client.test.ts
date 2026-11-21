import { describe, expect, test } from "bun:test";

import { createDeferredClient } from "./deferred-client";

describe("createDeferredClient", () => {
  test("replays calls made before the client loaded, in order", () => {
    const deferred = createDeferredClient<string[]>(10);
    deferred.run((log) => log.push("first"));
    deferred.run((log) => log.push("second"));

    const log: string[] = [];
    deferred.ready(log);
    expect(log).toEqual(["first", "second"]);
  });

  test("runs calls straight away once the client is ready", () => {
    const deferred = createDeferredClient<string[]>(10);
    const log: string[] = [];
    deferred.ready(log);
    deferred.run((client) => client.push("now"));
    expect(log).toEqual(["now"]);
  });

  test("replays each queued call once", () => {
    const deferred = createDeferredClient<string[]>(10);
    deferred.run((log) => log.push("queued"));
    const log: string[] = [];
    deferred.ready(log);
    deferred.ready(log);
    expect(log).toEqual(["queued"]);
  });

  test("drops calls beyond the queue limit", () => {
    const deferred = createDeferredClient<string[]>(2);
    for (const label of ["a", "b", "c"]) deferred.run((log) => log.push(label));
    const log: string[] = [];
    deferred.ready(log);
    expect(log).toEqual(["a", "b"]);
  });
});

describe("runWithin", () => {
  test("resolves once the call has run on the loaded client", async () => {
    const deferred = createDeferredClient<string[]>(10);
    let settled = false;
    const done = deferred
      .runWithin((log) => log.push("sent"), 60_000)
      .then(() => {
        settled = true;
      });
    await Bun.sleep(5);
    expect(settled).toBe(false);

    const log: string[] = [];
    deferred.ready(log);
    await done;
    expect(log).toEqual(["sent"]);
  });

  test("resolves after the timeout when the client never loads", async () => {
    const deferred = createDeferredClient<string[]>(10);
    const started = Date.now();
    await deferred.runWithin(() => {}, 20);
    expect(Date.now() - started).toBeGreaterThanOrEqual(15);
  });
});
