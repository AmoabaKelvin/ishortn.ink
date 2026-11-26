import { describe, expect, test } from "bun:test";

import { ServerTiming, formatMetric } from "./server-timing";

describe("formatMetric", () => {
  test("rounds the duration to whole milliseconds", () => {
    expect(formatMetric({ name: "db", dur: 12.6 })).toBe("db;dur=13");
  });

  test("quotes the description and drops characters that would break the quoting", () => {
    expect(formatMetric({ name: "safety", dur: 40, desc: 'blocked-"pre"\\llm' })).toBe(
      'safety;dur=40;desc="blocked-prellm"',
    );
  });

  test("never reports a negative duration", () => {
    expect(formatMetric({ name: "auth", dur: -1 })).toBe("auth;dur=0");
  });
});

describe("ServerTiming", () => {
  test("lists the steps in the order they finished, then total", async () => {
    const timing = new ServerTiming();
    timing.add("auth", 3);
    await timing.measure("domain", async () => "example");
    expect(timing.header()).toMatch(/^auth;dur=3, domain;dur=\d+, total;dur=\d+$/);
  });

  test("times a step that throws", async () => {
    const timing = new ServerTiming();
    const failed = timing.measure("alias", async () => {
      throw new Error("taken");
    });
    expect(failed).rejects.toThrow("taken");
    await failed.catch(() => {});
    expect(timing.header()).toMatch(/^alias;dur=\d+, total;dur=\d+$/);
  });

  test("sets the header on a response", () => {
    const timing = new ServerTiming();
    const response = timing.apply(Response.json({}, { status: 403 }));
    expect(response.headers.get("server-timing")).toMatch(/^total;dur=\d+$/);
  });
});
