import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  activeVersionId,
  deepProblem,
  gateOutcome,
  journalTags,
  missingMigrations,
  parseDeepHealth,
  statusProblem,
  type DeepProbe,
} from "./deploy-health";

const tags = ["0070_fix_bio_page_collation", "0071_numerous_bullseye", "0072_x"];

function healthy(applied: number, version: string | null = "abc123"): DeepProbe {
  return {
    kind: "body",
    status: 200,
    body: { ok: true, version, migrations: { expected: applied, applied, pending: [] } },
  };
}

describe("journalTags", () => {
  test("reads the repo's journal in order", () => {
    const repoTags = journalTags(readFileSync("drizzle/meta/_journal.json", "utf8"));
    expect(repoTags[0]).toStartWith("0000_");
    expect(repoTags).toContain("0071_numerous_bullseye");
  });

  test("rejects a journal without entries", () => {
    expect(() => journalTags("{}")).toThrow();
  });
});

describe("missingMigrations", () => {
  test("lists the journal entries past the applied count", () => {
    expect(missingMigrations(tags, 3)).toEqual([]);
    expect(missingMigrations(tags, 2)).toEqual(["0072_x"]);
    expect(missingMigrations(tags, 0)).toEqual(tags);
  });

  test("passes when production is ahead of the repo, e.g. after reverting a migration", () => {
    expect(missingMigrations(tags, 5)).toEqual([]);
  });
});

describe("parseDeepHealth", () => {
  test("parses a healthy body", () => {
    const text = JSON.stringify({
      ok: true,
      version: "abc123",
      durationMs: 208,
      tables: 33,
      migrations: { expected: 72, applied: 72, pending: [] },
    });
    expect(parseDeepHealth(200, text)).toEqual({
      kind: "body",
      status: 200,
      body: {
        ok: true,
        version: "abc123",
        migrations: { expected: 72, applied: 72, pending: [] },
      },
    });
  });

  test("parses an unhealthy body with pending migrations and failures", () => {
    const text = JSON.stringify({
      ok: false,
      version: null,
      migrations: { expected: 73, applied: 72, pending: ["0072_x"] },
      failures: [{ table: "User", error: "Unknown column 'x'" }],
    });
    const probe = parseDeepHealth(503, text);
    expect(probe).toMatchObject({
      kind: "body",
      status: 503,
      body: { migrations: { applied: 72, pending: ["0072_x"] } },
    });
  });

  test("classifies the bootstrap and auth responses", () => {
    expect(parseDeepHealth(404, "<html>Not found</html>")).toEqual({ kind: "missing" });
    expect(parseDeepHealth(401, '{"ok":false}')).toEqual({ kind: "unauthorized" });
    expect(parseDeepHealth(503, '{"ok":false,"error":"not configured"}')).toEqual({
      kind: "not-configured",
    });
  });

  test("marks non-JSON and unexpected JSON as unreadable", () => {
    expect(parseDeepHealth(502, "<html>Bad gateway</html>")).toMatchObject({ kind: "unreadable" });
    expect(parseDeepHealth(200, '{"status":"fine"}')).toMatchObject({ kind: "unreadable" });
  });
});

describe("gateOutcome", () => {
  test("fails naming the migrations production hasn't applied", () => {
    const probe = parseDeepHealth(
      503,
      JSON.stringify({
        ok: false,
        version: "old",
        migrations: { expected: 72, applied: 2, pending: ["0072_x"] },
      }),
    );
    const outcome = gateOutcome(tags, probe);
    expect(outcome.level).toBe("fail");
    expect(outcome.message).toContain("Missing: 0072_x.");
    expect(outcome.message).toContain("bun run db:production:migrate");
  });

  test("passes when every migration is applied, even if production is unhealthy", () => {
    const probe = parseDeepHealth(
      503,
      JSON.stringify({
        ok: false,
        migrations: { expected: 3, applied: 3, pending: [] },
        failures: [{ table: "User", error: "boom" }],
      }),
    );
    expect(gateOutcome(tags, probe).level).toBe("pass");
    expect(gateOutcome(tags, healthy(3)).level).toBe("pass");
  });

  test("warns and continues while the endpoint or its secret isn't deployed", () => {
    expect(gateOutcome(tags, { kind: "missing" }).level).toBe("warn");
    expect(gateOutcome(tags, { kind: "not-configured" }).level).toBe("warn");
  });

  test("fails on a bad token", () => {
    expect(gateOutcome(tags, { kind: "unauthorized" }).level).toBe("fail");
  });

  test("retries when the migration state can't be read", () => {
    expect(gateOutcome(tags, { kind: "unreadable", reason: "fetch failed" }).level).toBe("retry");
    const noCount = parseDeepHealth(
      503,
      JSON.stringify({
        ok: false,
        migrations: { expected: 3, applied: null, pending: [] },
        failures: [{ table: "__drizzle_migrations", error: "Table doesn't exist" }],
      }),
    );
    const outcome = gateOutcome(tags, noCount);
    expect(outcome.level).toBe("retry");
    expect(outcome.message).toContain("__drizzle_migrations (Table doesn't exist)");
  });
});

describe("deepProblem", () => {
  test("passes a healthy response for this commit", () => {
    expect(deepProblem(healthy(3, "abc123"), "abc123", false)).toBeNull();
  });

  test("keeps polling while the old worker still answers", () => {
    expect(deepProblem(healthy(3, "old"), "abc123", false)).toContain("still reports version old");
    expect(deepProblem({ kind: "missing" }, "abc123", false)).toContain("404");
  });

  test("accepts a build that doesn't report its version", () => {
    expect(deepProblem(healthy(3, null), "abc123", false)).toBeNull();
    expect(deepProblem(healthy(3, ""), "abc123", false)).toBeNull();
  });

  test("accepts a 404 when the deployed code predates the endpoint", () => {
    expect(deepProblem({ kind: "missing" }, null, true)).toBeNull();
  });

  test("reports pending migrations and failing tables", () => {
    const probe = parseDeepHealth(
      503,
      JSON.stringify({
        ok: false,
        version: "abc123",
        migrations: { expected: 3, applied: 2, pending: ["0072_x"] },
        failures: [{ table: "User", error: "Unknown column 'x'" }],
      }),
    );
    expect(deepProblem(probe, "abc123", false)).toBe(
      "deep health returned 503, pending migrations: 0072_x, failing: User (Unknown column 'x')",
    );
  });

  test("treats a bad token and an unreadable body as unhealthy", () => {
    expect(deepProblem({ kind: "unauthorized" }, null, true)).toContain("401");
    expect(deepProblem({ kind: "unreadable", reason: "timed out" }, null, true)).toContain(
      "timed out",
    );
  });
});

describe("statusProblem", () => {
  test("compares the status code", () => {
    expect(statusProblem("https://ishortn.ink/", 200, 200)).toBeNull();
    expect(statusProblem("https://isht.ink/x", 500, 404)).toBe(
      "https://isht.ink/x returned 500, expected 404",
    );
    expect(statusProblem("https://ishortn.ink/", "fetch failed", 200)).toContain("fetch failed");
  });
});

describe("activeVersionId", () => {
  test("reads the live version from wrangler deployments status", () => {
    const json = JSON.stringify({
      id: "dep-1",
      created_on: "2026-11-20T08:00:00Z",
      versions: [{ version_id: "v-live", percentage: 100 }],
    });
    expect(activeVersionId(json)).toEqual({ versionId: "v-live", split: false });
  });

  test("picks the version with most traffic in a split deployment", () => {
    const json = JSON.stringify({
      versions: [
        { version_id: "v-new", percentage: 10 },
        { version_id: "v-old", percentage: 90 },
      ],
    });
    expect(activeVersionId(json)).toEqual({ versionId: "v-old", split: true });
  });

  test("rejects output without a version", () => {
    expect(() => activeVersionId('{"versions":[]}')).toThrow();
  });
});
