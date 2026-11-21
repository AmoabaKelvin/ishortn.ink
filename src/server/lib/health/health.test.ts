import { describe, expect, test } from "bun:test";

import { healthCheck } from "./health";

describe("healthCheck", () => {
  test("answers 200 when the database responds", async () => {
    const res = await healthCheck(async () => {});
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true });
  });

  test("answers 503 without error details when the query fails", async () => {
    const res = await healthCheck(async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.5:3306");
    });
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: false });
  });

  test("answers 503 when the database does not respond in time", async () => {
    const res = await healthCheck(() => new Promise(() => {}), 10);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false });
  });
});
