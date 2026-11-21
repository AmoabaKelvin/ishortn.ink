import { createHash, timingSafeEqual } from "node:crypto";

import { is } from "drizzle-orm";
import { MySqlTable } from "drizzle-orm/mysql-core";

import type * as Schema from "@/server/db/schema";

export type JournalEntry = { tag: string; when: number };

export type MigrationState = { applied: number; lastCreatedAt: number | null };

export type TableProbe = { table: string; probe: () => Promise<void> };

export type DeepHealthDeps = {
  token: string | undefined;
  version: string | null;
  tables: TableProbe[];
  readMigrations: () => Promise<MigrationState>;
  journal: JournalEntry[];
  timeoutMs?: number;
};

type Failure = { table: string; error: string };

type HealthBody =
  | { ok: false; error: string }
  | {
      ok: boolean;
      version: string | null;
      durationMs: number;
      tables: number;
      migrations: { expected: number; applied: number | null; pending: string[] };
      failures?: Failure[];
    };

export const MIGRATIONS_TABLE = "__drizzle_migrations";
const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_ERROR_LENGTH = 200;

/** Every table exported from the schema, so new tables are probed without a hand-kept list. */
export function schemaTables(schema: typeof Schema): MySqlTable[] {
  return Object.values<object>(schema).filter((value): value is MySqlTable =>
    is(value, MySqlTable),
  );
}

function json(body: HealthBody, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

// Hashing first makes both buffers the same length, so the compare leaks
// neither the token nor its length.
function tokenMatches(authorization: string | null, token: string): boolean {
  if (!authorization?.startsWith("Bearer ")) return false;
  const provided = createHash("sha256").update(authorization.slice(7)).digest();
  const expected = createHash("sha256").update(token).digest();
  return timingSafeEqual(provided, expected);
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Drizzle wraps driver errors as "Failed query: <sql>"; the driver's own
// message ("Unknown column ...") is on `cause` and is the useful part.
export function describeError(error: Error): string {
  const message = error.cause instanceof Error ? error.cause.message : error.message;
  return message.length > MAX_ERROR_LENGTH ? `${message.slice(0, MAX_ERROR_LENGTH)}…` : message;
}

async function attempt<T>(
  table: string,
  run: () => Promise<T>,
  ms: number,
): Promise<{ value: T } | { failure: Failure }> {
  try {
    return { value: await withTimeout(run(), ms) };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { failure: { table, error: describeError(err) } };
  }
}

/** Drizzle's migrator applies every journal entry newer than the last applied `created_at`. */
export function pendingMigrations(journal: JournalEntry[], lastCreatedAt: number | null): string[] {
  return journal
    .filter((entry) => lastCreatedAt === null || entry.when > lastCreatedAt)
    .map((entry) => entry.tag);
}

export async function deepHealthCheck(request: Request, deps: DeepHealthDeps): Promise<Response> {
  if (!deps.token) return json({ ok: false, error: "not configured" }, 503);
  if (!tokenMatches(request.headers.get("Authorization"), deps.token)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const startedAt = Date.now();
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const [tableResults, migrationResult] = await Promise.all([
    Promise.all(deps.tables.map(({ table, probe }) => attempt(table, probe, timeoutMs))),
    attempt(MIGRATIONS_TABLE, deps.readMigrations, timeoutMs),
  ]);

  const failures = [...tableResults, migrationResult].flatMap((result) =>
    "failure" in result ? [result.failure] : [],
  );
  const migrations = "value" in migrationResult ? migrationResult.value : null;
  const pending = migrations ? pendingMigrations(deps.journal, migrations.lastCreatedAt) : [];

  const ok = failures.length === 0 && pending.length === 0;
  return json(
    {
      ok,
      version: deps.version,
      durationMs: Date.now() - startedAt,
      tables: deps.tables.length,
      migrations: {
        expected: deps.journal.length,
        applied: migrations?.applied ?? null,
        pending,
      },
      ...(failures.length > 0 && { failures }),
    },
    ok ? 200 : 503,
  );
}
