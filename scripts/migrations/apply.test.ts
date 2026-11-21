import { describe, expect, test } from "bun:test";

import { type ApplyDeps, latestJournalTag, type MigratorRequest, runMigrator } from "./apply";

const request: MigratorRequest = {
  action: "apply",
  allowDangerous: false,
  key: "test-key",
  url: "https://migrator.test",
};

/** Answers each migrator call with the next reply; the clock advances only on sleep. */
function fakeMigrator(replies: Array<{ status?: number; body: unknown }>) {
  let clock = 0;
  const calls: string[] = [];
  const deps: ApplyDeps = {
    fetch: async (_url, init) => {
      // SAFETY: callMigrator always passes headers as a plain object.
      const headers = init.headers as Record<string, string>;
      calls.push(headers["x-migrate-action"] ?? "");
      const next = replies[Math.min(calls.length - 1, replies.length - 1)];
      if (!next) throw new Error("no reply configured");
      return new Response(JSON.stringify(next.body), { status: next.status ?? 200 });
    },
    sleep: async (ms) => {
      clock += ms;
    },
    now: () => clock,
    log: () => {},
  };
  return { deps, calls, elapsed: () => clock };
}

describe("runMigrator", () => {
  test("succeeds when the latest applied migration matches the bundle", async () => {
    const { deps, calls } = fakeMigrator([
      {
        body: { ok: true, latestApplied: "0081_burly_red_hulk", applied: ["0081_burly_red_hulk"] },
      },
    ]);
    expect(await runMigrator(request, "0081_burly_red_hulk", deps)).toEqual({ ok: true });
    expect(calls).toEqual(["apply"]);
  });

  test("retries until a stale migrator catches up", async () => {
    const { deps, calls } = fakeMigrator([
      { body: { ok: true, latestApplied: "0080_numerous_dark_beast", applied: [] } },
      { body: { ok: true, latestApplied: "0080_numerous_dark_beast", applied: [] } },
      {
        body: { ok: true, latestApplied: "0081_burly_red_hulk", applied: ["0081_burly_red_hulk"] },
      },
    ]);
    expect(await runMigrator(request, "0081_burly_red_hulk", deps)).toEqual({ ok: true });
    expect(calls).toEqual(["apply", "apply", "apply"]);
  });

  test("fails when the latest applied migration still lags the bundle after a minute", async () => {
    const { deps, calls, elapsed } = fakeMigrator([
      { body: { ok: true, latestApplied: "0080_numerous_dark_beast", applied: [] } },
    ]);
    const result = await runMigrator(request, "0081_burly_red_hulk", deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("0080_numerous_dark_beast");
      expect(result.reason).toContain("0081_burly_red_hulk");
    }
    expect(elapsed()).toBeLessThanOrEqual(60_000);
    expect(calls.length).toBeGreaterThan(1);
  });

  test("fails without retrying when the migrator refuses", async () => {
    const { deps, calls } = fakeMigrator([
      { status: 409, body: { ok: false, message: "refusing dangerous migrations (0081)" } },
    ]);
    expect(await runMigrator(request, "0081_burly_red_hulk", deps)).toEqual({
      ok: false,
      reason: "refusing dangerous migrations (0081)",
    });
    expect(calls).toEqual(["apply"]);
  });

  test("retries while the Worker is unavailable", async () => {
    const { deps, calls } = fakeMigrator([
      { status: 503, body: {} },
      { body: { ok: true, latestApplied: "0081_burly_red_hulk", applied: [] } },
    ]);
    expect(await runMigrator(request, "0081_burly_red_hulk", deps)).toEqual({ ok: true });
    expect(calls).toEqual(["apply", "apply"]);
  });

  test("status only reports, whatever the latest applied migration", async () => {
    const { deps, calls } = fakeMigrator([
      { body: { ok: true, latestApplied: "0080_numerous_dark_beast", pending: [] } },
    ]);
    expect(
      await runMigrator({ ...request, action: "status" }, "0081_burly_red_hulk", deps),
    ).toEqual({ ok: true });
    expect(calls).toEqual(["status"]);
  });
});

describe("latestJournalTag", () => {
  test("returns the last journal entry's tag", () => {
    const journal = JSON.stringify({
      entries: [{ tag: "0080_numerous_dark_beast" }, { tag: "0081_burly_red_hulk" }],
    });
    expect(latestJournalTag(journal)).toBe("0081_burly_red_hulk");
  });

  test("rejects an empty journal", () => {
    expect(() => latestJournalTag(JSON.stringify({ entries: [] }))).toThrow();
  });
});
