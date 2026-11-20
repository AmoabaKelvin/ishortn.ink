import { describe, expect, test } from "bun:test";

import { getTableName } from "drizzle-orm";

import * as schema from "@/server/db/schema";

import {
  deepHealthCheck,
  describeError,
  pendingMigrations,
  schemaTables,
  type DeepHealthDeps,
} from "./deep-health";

const TOKEN = "s3cret-token";

const journal = [
  { tag: "0000_first", when: 1000 },
  { tag: "0001_second", when: 2000 },
];

function deps(overrides: Partial<DeepHealthDeps> = {}): DeepHealthDeps {
  return {
    token: TOKEN,
    version: "abc123",
    tables: [
      { table: "User", probe: async () => [] },
      { table: "Link", probe: async () => [] },
    ],
    readMigrations: async () => ({ applied: 2, lastCreatedAt: 2000 }),
    journal,
    ...overrides,
  };
}

function request(authorization?: string): Request {
  const headers = new Headers();
  if (authorization) headers.set("Authorization", authorization);
  return new Request("https://ishortn.ink/api/health/deep", { headers });
}

describe("deepHealthCheck", () => {
  test("answers 503 when no token is configured", async () => {
    const res = await deepHealthCheck(request(`Bearer ${TOKEN}`), deps({ token: undefined }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, error: "not configured" });
  });

  test("answers 401 for a missing or wrong token", async () => {
    for (const auth of [undefined, "Bearer nope", TOKEN, `Bearer ${TOKEN}x`]) {
      const res = await deepHealthCheck(request(auth), deps());
      expect(res.status).toBe(401);
    }
  });

  test("answers 200 when every table and migration checks out", async () => {
    const res = await deepHealthCheck(request(`Bearer ${TOKEN}`), deps());
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      version: "abc123",
      tables: 2,
      migrations: { expected: 2, applied: 2, pending: [] },
    });
    expect(body.failures).toBeUndefined();
    expect(body.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("answers 503 naming the table whose query throws", async () => {
    const res = await deepHealthCheck(
      request(`Bearer ${TOKEN}`),
      deps({
        tables: [
          { table: "User", probe: () => Promise.reject(new Error("Unknown column 'x'")) },
          { table: "Link", probe: async () => [] },
        ],
      }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      ok: false,
      failures: [{ table: "User", error: "Unknown column 'x'" }],
    });
  });

  test("answers 503 listing migrations the database has not applied", async () => {
    const res = await deepHealthCheck(
      request(`Bearer ${TOKEN}`),
      deps({ readMigrations: async () => ({ applied: 1, lastCreatedAt: 1000 }) }),
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.migrations).toEqual({ expected: 2, applied: 1, pending: ["0001_second"] });
    expect(body.failures).toBeUndefined();
  });

  test("answers 503 when the migrations table cannot be read", async () => {
    const res = await deepHealthCheck(
      request(`Bearer ${TOKEN}`),
      deps({ readMigrations: () => Promise.reject(new Error("Table doesn't exist")) }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      migrations: { applied: null },
      failures: [{ table: "__drizzle_migrations", error: "Table doesn't exist" }],
    });
  });

  test("fails a table query that outlives the timeout", async () => {
    const res = await deepHealthCheck(
      request(`Bearer ${TOKEN}`),
      deps({
        timeoutMs: 10,
        tables: [{ table: "User", probe: () => new Promise(() => {}) }],
      }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      failures: [{ table: "User", error: "timed out after 10ms" }],
    });
  });
});

describe("describeError", () => {
  test("prefers the driver's message over drizzle's query wrapper", () => {
    const error = new Error("Failed query: select ...", {
      cause: new Error("Unknown column 'User.plan' in 'field list'"),
    });
    expect(describeError(error)).toBe("Unknown column 'User.plan' in 'field list'");
  });

  test("truncates long messages", () => {
    const message = describeError(new Error("x".repeat(500)));
    expect(message.length).toBe(201);
  });
});

describe("pendingMigrations", () => {
  test("lists every entry newer than the last applied migration", () => {
    expect(pendingMigrations(journal, 2000)).toEqual([]);
    expect(pendingMigrations(journal, 1500)).toEqual(["0001_second"]);
    expect(pendingMigrations(journal, null)).toEqual(["0000_first", "0001_second"]);
  });
});

describe("schemaTables", () => {
  test("finds every table exported from the schema and nothing else", () => {
    const names = schemaTables(schema).map(getTableName);
    expect(names).toContain("User");
    expect(names).toContain("Link");
    expect(names).toContain("BioBlock");
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBeGreaterThanOrEqual(33);
  });
});
