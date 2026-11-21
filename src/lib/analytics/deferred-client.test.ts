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
