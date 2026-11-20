/**
 * Guards production deploys in .github/workflows/deploy-worker.yml.
 *
 *   bun scripts/ci/deploy-health.ts gate              before build: refuse to ship migrations
 *                                                     production hasn't applied
 *   bun scripts/ci/deploy-health.ts previous-version  before deploy: write the live version id
 *                                                     to $GITHUB_OUTPUT as `version_id`
 *   bun scripts/ci/deploy-health.ts verify --rollback-to <version-id>
 *                                                     after deploy: poll until healthy, otherwise
 *                                                     roll back and fail
 *
 * Reads HEALTHCHECK_TOKEN and GITHUB_SHA. HEALTH_DEEP_URL, HEALTH_SITE_URL and
 * HEALTH_MISSING_ALIAS_URL override the production URLs for local runs.
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { z } from "zod";

const DEEP_URL = process.env.HEALTH_DEEP_URL ?? "https://ishortn.ink/api/health/deep";
const SITE_URL = process.env.HEALTH_SITE_URL ?? "https://ishortn.ink/";
const MISSING_ALIAS_URL =
  process.env.HEALTH_MISSING_ALIAS_URL ?? "https://isht.ink/healthcheck-missing-alias";
const JOURNAL_PATH = "drizzle/meta/_journal.json";
// Present once the deep health endpoint ships; until then a 404 from it is expected.
const DEEP_ROUTE_PATH = "src/app/api/health/deep/route.ts";

const REQUEST_TIMEOUT_MS = 15_000;
// The first try plus three retries.
const GATE_ATTEMPTS = 4;
const GATE_RETRY_DELAY_MS = 5_000;
const VERIFY_INTERVAL_MS = 10_000;
const VERIFY_TIMEOUT_MS = 180_000;

const journalFile = z.object({ entries: z.array(z.object({ tag: z.string() })) });

const deepHealthBody = z.object({
  ok: z.boolean(),
  version: z.string().nullish(),
  error: z.string().optional(),
  migrations: z
    .object({
      expected: z.number(),
      applied: z.number().nullable(),
      pending: z.array(z.string()),
    })
    .optional(),
  failures: z.array(z.object({ table: z.string(), error: z.string() })).optional(),
});

export type DeepHealthBody = z.infer<typeof deepHealthBody>;

export type DeepProbe =
  | { kind: "body"; status: number; body: DeepHealthBody }
  | { kind: "missing" }
  | { kind: "unauthorized" }
  | { kind: "not-configured" }
  | { kind: "unreadable"; reason: string };

export type ActiveVersion = { versionId: string; split: boolean };

export type GateOutcome = { level: "pass" | "warn" | "fail" | "retry"; message: string };

export function journalTags(json: string): string[] {
  return journalFile.parse(JSON.parse(json)).entries.map((entry) => entry.tag);
}

export function parseDeepHealth(status: number, text: string): DeepProbe {
  if (status === 404) return { kind: "missing" };
  if (status === 401) return { kind: "unauthorized" };
  let parsed: ReturnType<typeof deepHealthBody.safeParse>;
  try {
    parsed = deepHealthBody.safeParse(JSON.parse(text));
  } catch {
    return { kind: "unreadable", reason: `HTTP ${status} with a non-JSON body` };
  }
  if (!parsed.success) {
    return { kind: "unreadable", reason: `HTTP ${status} with an unexpected JSON body` };
  }
  if (parsed.data.error === "not configured") return { kind: "not-configured" };
  return { kind: "body", status, body: parsed.data };
}

/** Journal entries past the number production has applied; drizzle applies them in order. */
export function missingMigrations(tags: string[], applied: number): string[] {
  return tags.slice(applied);
}

export function gateOutcome(tags: string[], probe: DeepProbe): GateOutcome {
  switch (probe.kind) {
    case "missing":
      return {
        level: "warn",
        message: `${DEEP_URL} returned 404 (not deployed yet), so the migration gate was skipped.`,
      };
    case "not-configured":
      return {
        level: "warn",
        message:
          "The Worker has no HEALTHCHECK_TOKEN secret, so the migration gate was skipped. Set it with `wrangler secret put HEALTHCHECK_TOKEN`.",
      };
    case "unauthorized":
      return {
        level: "fail",
        message:
          "The deep health endpoint rejected HEALTHCHECK_TOKEN (401). The GitHub secret must match the Worker secret.",
      };
    case "unreadable":
      return { level: "retry", message: probe.reason };
    case "body": {
      const applied = probe.body.migrations?.applied;
      if (applied === undefined || applied === null) {
        return {
          level: "retry",
          message: `HTTP ${probe.status} without an applied migration count${describeFailures(probe.body)}`,
        };
      }
      const missing = missingMigrations(tags, applied);
      if (missing.length > 0) {
        return {
          level: "fail",
          message: `Production has applied ${applied} of this commit's ${tags.length} migrations. Missing: ${missing.join(", ")}. Apply them to production (bun run db:production:migrate), then re-run this workflow.`,
        };
      }
      return {
        level: "pass",
        message: `Production has applied ${applied} migrations; this commit has ${tags.length}.`,
      };
    }
  }
}

/**
 * Why the deep endpoint isn't healthy for `expectVersion`, or null when it is.
 * `allowMissing` accepts a 404 for deployments whose code predates the endpoint.
 */
export function deepProblem(
  probe: DeepProbe,
  expectVersion: string | null,
  allowMissing: boolean,
): string | null {
  switch (probe.kind) {
    case "missing":
      return allowMissing ? null : "deep health returned 404";
    // The Worker secret isn't set yet: nothing to verify against, so don't roll back over it.
    case "not-configured":
      return null;
    case "unauthorized":
      return "deep health rejected HEALTHCHECK_TOKEN (401)";
    case "unreadable":
      return `deep health: ${probe.reason}`;
    case "body": {
      const { body, status } = probe;
      if (status !== 200 || !body.ok) {
        const pending = body.migrations?.pending ?? [];
        const pendingText = pending.length > 0 ? `, pending migrations: ${pending.join(", ")}` : "";
        return `deep health returned ${status}${pendingText}${describeFailures(body)}`;
      }
      // An empty or null version means the build doesn't report one, so it can't be matched.
      if (expectVersion && body.version && body.version !== expectVersion) {
        return `deep health still reports version ${body.version}, expected ${expectVersion}`;
      }
      return null;
    }
  }
}

export function statusProblem(url: string, actual: number | string, expected: number) {
  return actual === expected ? null : `${url} returned ${actual}, expected ${expected}`;
}

/** The version serving all (or most) traffic in `wrangler deployments status --json` output. */
export function activeVersionId(json: string): ActiveVersion {
  const deployment = z
    .object({
      versions: z.array(z.object({ version_id: z.string().min(1), percentage: z.number() })).min(1),
    })
    .parse(JSON.parse(json));
  const top = deployment.versions.reduce((a, b) => (b.percentage > a.percentage ? b : a));
  return { versionId: top.version_id, split: deployment.versions.length > 1 };
}

function describeFailures(body: DeepHealthBody): string {
  const failures = body.failures ?? [];
  if (failures.length === 0) return "";
  return `, failing: ${failures.map((failure) => `${failure.table} (${failure.error})`).join("; ")}`;
}

// GitHub workflow commands end at a newline.
function annotate(level: "error" | "warning" | "notice", message: string) {
  console.log(`::${level}::${message.replaceAll("\n", "%0A")}`);
}

async function fetchStatus(url: string, token?: string) {
  const headers = new Headers({ "User-Agent": "ishortn-deploy-check" });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, {
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return { status: response.status, text: await response.text() };
}

async function probeDeep(token: string): Promise<DeepProbe> {
  try {
    const { status, text } = await fetchStatus(DEEP_URL, token);
    return parseDeepHealth(status, text);
  } catch (error) {
    return { kind: "unreadable", reason: error instanceof Error ? error.message : String(error) };
  }
}

async function probeStatus(url: string): Promise<number | string> {
  try {
    return (await fetchStatus(url)).status;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function gate(): Promise<number> {
  const tags = journalTags(readFileSync(JOURNAL_PATH, "utf8"));
  const token = process.env.HEALTHCHECK_TOKEN;
  if (!token) {
    annotate("warning", "HEALTHCHECK_TOKEN is not set, so the migration gate was skipped.");
    return 0;
  }
  for (let attempt = 1; ; attempt++) {
    const outcome = gateOutcome(tags, await probeDeep(token));
    if (outcome.level === "retry" && attempt < GATE_ATTEMPTS) {
      console.log(`Attempt ${attempt}/${GATE_ATTEMPTS}: ${outcome.message}; retrying.`);
      await sleep(GATE_RETRY_DELAY_MS);
      continue;
    }
    if (outcome.level === "pass") console.log(outcome.message);
    if (outcome.level === "warn") annotate("warning", outcome.message);
    if (outcome.level === "fail") annotate("error", outcome.message);
    if (outcome.level === "retry") {
      annotate(
        "error",
        `Could not read production's migration state after ${GATE_ATTEMPTS} attempts (${outcome.message}). Not deploying.`,
      );
    }
    return outcome.level === "pass" || outcome.level === "warn" ? 0 : 1;
  }
}

function wrangler(args: string[]) {
  return spawnSync("bunx", ["wrangler", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function previousVersion(): number {
  const result = wrangler(["deployments", "status", "--json"]);
  const stdout = result.stdout;
  if (result.status !== 0) {
    annotate("error", "`wrangler deployments status` failed, so there is no rollback target.");
    return 1;
  }
  const { versionId, split } = activeVersionId(stdout);
  if (split) {
    annotate("warning", `Traffic is split across versions; rollback target is ${versionId}.`);
  }
  console.log(`Live version before deploy: ${versionId}`);
  const output = process.env.GITHUB_OUTPUT;
  if (output) appendFileSync(output, `version_id=${versionId}\n`);
  return 0;
}

/** Polls until one round passes every check; returns the last round's problems otherwise. */
async function pollHealthy(expectVersion: string | null, requireDeep: boolean) {
  const token = process.env.HEALTHCHECK_TOKEN;
  const deadline = Date.now() + VERIFY_TIMEOUT_MS;
  for (let round = 1; ; round++) {
    const [deep, site, missingAlias] = await Promise.all([
      token ? probeDeep(token) : null,
      probeStatus(SITE_URL),
      probeStatus(MISSING_ALIAS_URL),
    ]);
    const problems = [
      deep && deepProblem(deep, expectVersion, !requireDeep),
      statusProblem(SITE_URL, site, 200),
      statusProblem(MISSING_ALIAS_URL, missingAlias, 404),
    ].filter((problem) => problem !== null);
    if (problems.length === 0) {
      if (deep?.kind === "not-configured") {
        annotate(
          "warning",
          "The Worker has no HEALTHCHECK_TOKEN secret; the deep check was skipped.",
        );
      }
      return [];
    }
    console.log(`Round ${round}: ${problems.join("; ")}`);
    if (Date.now() + VERIFY_INTERVAL_MS > deadline) return problems;
    await sleep(VERIFY_INTERVAL_MS);
  }
}

async function verify(rollbackTo: string | undefined): Promise<number> {
  const sha = process.env.GITHUB_SHA ?? null;
  if (!process.env.HEALTHCHECK_TOKEN) {
    annotate("warning", "HEALTHCHECK_TOKEN is not set, so only the public URLs are verified.");
  }
  const problems = await pollHealthy(sha, existsSync(DEEP_ROUTE_PATH));
  if (problems.length === 0) {
    console.log(`Deploy of ${sha ?? "this commit"} is healthy.`);
    return 0;
  }
  const failure = `Deploy of ${sha ?? "this commit"} failed verification: ${problems.join("; ")}.`;
  if (!rollbackTo) {
    annotate("error", `${failure} No previous version was recorded, so nothing was rolled back.`);
    return 1;
  }

  const message = `Auto-rollback: ${sha ?? "deploy"} failed post-deploy verification`;
  const rollback = wrangler(["rollback", rollbackTo, "-y", "--message", message]);
  console.log(rollback.stdout);
  if (rollback.status !== 0) {
    annotate(
      "error",
      `${failure} Rolling back to ${rollbackTo} FAILED; roll back by hand with \`wrangler rollback ${rollbackTo}\`.`,
    );
    return 1;
  }

  // The old version reports its own commit, and may predate the deep endpoint.
  const after = await pollHealthy(null, false);
  const state =
    after.length === 0 ? "and it is healthy" : `but it is STILL UNHEALTHY: ${after.join("; ")}`;
  annotate(
    "error",
    `${failure} Rolled back to version ${rollbackTo} ${state}. Set the repo variable DEPLOY_FREEZE=true to stop the next merge redeploying.`,
  );
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, ...rest] = process.argv.slice(2);
  const rollbackIndex = rest.indexOf("--rollback-to");
  const rollbackTo = rollbackIndex === -1 ? undefined : rest[rollbackIndex + 1] || undefined;
  const run =
    command === "gate"
      ? gate
      : command === "previous-version"
        ? async () => previousVersion()
        : command === "verify"
          ? () => verify(rollbackTo)
          : null;
  if (!run) {
    console.error("Usage: deploy-health.ts gate | previous-version | verify --rollback-to <id>");
    process.exit(2);
  }
  process.exit(await run());
}
