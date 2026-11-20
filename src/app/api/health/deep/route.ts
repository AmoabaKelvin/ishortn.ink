import { getTableColumns, getTableName, sql } from "drizzle-orm";
import { z } from "zod";

import { env } from "@/env.mjs";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import {
  deepHealthCheck,
  MIGRATIONS_TABLE,
  schemaTables,
  type MigrationState,
} from "@/server/lib/health/deep-health";

import journal from "../../../../../drizzle/meta/_journal.json";

export const dynamic = "force-dynamic";

// Every query carries NOW(): Hyperdrive caches SELECTs but skips queries that
// call volatile functions, and a cached result would hide the very drift this
// endpoint exists to catch.
const tables = schemaTables(schema).map((table) => ({
  table: getTableName(table),
  // Selecting every column by name makes a missing column or table an error.
  probe: async () => {
    await db
      .select({ ...getTableColumns(table), healthCheckAt: sql`NOW()` })
      .from(table)
      .limit(1);
  },
}));

const migrationsRow = z.object({
  applied: z.coerce.number(),
  lastCreatedAt: z.coerce.number().nullable(),
});

async function readMigrations(): Promise<MigrationState> {
  const [rows] = await db.execute(
    sql`SELECT COUNT(*) AS applied, MAX(created_at) AS lastCreatedAt, NOW() AS checkedAt FROM ${sql.identifier(MIGRATIONS_TABLE)}`,
  );
  // An aggregate without GROUP BY always returns exactly one row.
  const [row] = z.array(migrationsRow).length(1).parse(rows);
  return row!;
}

/**
 * Proves the deployed code and the production database agree: every schema
 * table answers a full-column SELECT and no bundled migration is unapplied.
 *
 * Usage: GET /api/health/deep with `Authorization: Bearer <HEALTHCHECK_TOKEN>`.
 */
export function GET(request: Request) {
  return deepHealthCheck(request, {
    token: env.HEALTHCHECK_TOKEN,
    version: env.BUILD_COMMIT_SHA ?? null,
    tables,
    readMigrations,
    journal: journal.entries,
  });
}
