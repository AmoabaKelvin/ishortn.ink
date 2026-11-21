// Deploy step: asks the migrator Worker to apply pending migrations and fails
// the deploy when it refuses (dangerous SQL, drift), a statement errors, or it
// still hasn't reached the newest migration in this commit's journal.
//   bun scripts/migrations/apply.ts [status|apply]
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { z } from "zod";

// A just-deployed Worker can take a few seconds to answer everywhere.
const UNAVAILABLE_ATTEMPTS = 6;
const RETRY_DELAY_MS = 5_000;
// Right after `wrangler deploy` a request can still reach the previous migrator
// version, whose bundle lacks the new migrations and reports them as nothing to do.
const CATCH_UP_TIMEOUT_MS = 60_000;

const reply = z.object({
  ok: z.boolean(),
  message: z.string().optional(),
  latestApplied: z.string().nullish(),
});

export type MigratorRequest = {
  action: "status" | "apply";
  allowDangerous: boolean;
  key: string;
  url: string;
};

export type ApplyDeps = {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  log: (message: string) => void;
};

export type ApplyResult = { ok: true } | { ok: false; reason: string };

export function latestJournalTag(json: string): string {
  const { entries } = z
    .object({ entries: z.array(z.object({ tag: z.string() })).min(1) })
    .parse(JSON.parse(json));
  // SAFETY: `.min(1)` above guarantees a last entry.
  return entries.at(-1)!.tag;
}

async function callMigrator(request: MigratorRequest, deps: ApplyDeps) {
  const allowDangerous = request.allowDangerous ? "1" : "0";
  let response: Response | undefined;
  for (let attempt = 1; attempt <= UNAVAILABLE_ATTEMPTS; attempt++) {
    const timestamp = String(deps.now());
    const signature = createHmac("sha256", request.key)
      .update(`${timestamp}.${request.action}.${allowDangerous}`)
      .digest("hex");
    response = await deps.fetch(request.url, {
      method: "POST",
      headers: {
        "x-migrate-timestamp": timestamp,
        "x-migrate-signature": signature,
        "x-migrate-action": request.action,
        "x-migrate-allow-dangerous": allowDangerous,
      },
    });
    if (response.status !== 404 && response.status !== 503) break;
    await deps.sleep(RETRY_DELAY_MS);
  }
  if (!response) throw new Error("no response from the migrator");

  const text = await response.text();
  const isJson = text.trim().startsWith("{");
  // Only the migrator's JSON is worth printing; anything else is an error page.
  deps.log(isJson ? text : `HTTP ${response.status} (${text.length} bytes, not from the migrator)`);
  const parsed = reply.safeParse(JSON.parse(isJson ? text : "null"));
  if (!response.ok || !parsed.success || !parsed.data.ok) {
    const reason = parsed.success
      ? (parsed.data.message ?? `HTTP ${response.status}`)
      : `HTTP ${response.status}: ${text.slice(0, 200)}`;
    return { ok: false as const, reason };
  }
  return { ok: true as const, latestApplied: parsed.data.latestApplied ?? null };
}

/**
 * Runs `request` against the migrator. An apply only succeeds once the migrator
 * reports `expectedLatest` as applied; until then it is re-sent for up to a minute.
 */
export async function runMigrator(
  request: MigratorRequest,
  expectedLatest: string,
  deps: ApplyDeps,
): Promise<ApplyResult> {
  const deadline = deps.now() + CATCH_UP_TIMEOUT_MS;
  for (;;) {
    const result = await callMigrator(request, deps);
    if (!result.ok) return result;
    if (request.action === "status" || result.latestApplied === expectedLatest) return { ok: true };
    const behind = `the migrator reports ${result.latestApplied ?? "no migrations"} as the latest applied, but this commit's latest is ${expectedLatest}`;
    if (deps.now() + RETRY_DELAY_MS > deadline) {
      return {
        ok: false,
        reason: `${behind} after retrying for ${CATCH_UP_TIMEOUT_MS / 1000}s. The request is probably reaching an older migrator version; re-run the workflow.`,
      };
    }
    deps.log(`${behind}; retrying in ${RETRY_DELAY_MS / 1000}s.`);
    await deps.sleep(RETRY_DELAY_MS);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const key = process.env.MIGRATE_KEY;
  const url = process.env.MIGRATOR_URL;
  if (!key || !url) throw new Error("MIGRATE_KEY and MIGRATOR_URL are required");
  const action = process.argv[2] === "status" ? "status" : "apply";
  const result = await runMigrator(
    { action, key, url, allowDangerous: process.env.ALLOW_DANGEROUS_MIGRATIONS === "true" },
    latestJournalTag(readFileSync("drizzle/meta/_journal.json", "utf8")),
    { fetch, sleep: (ms) => sleep(ms), now: Date.now, log: console.log },
  );
  if (!result.ok) {
    console.error(`::error::Migrations ${action} failed: ${result.reason}`);
    process.exit(1);
  }
}
