import { sql } from "drizzle-orm";

import { db } from "@/server/db";
import { healthCheck } from "@/server/lib/health/health";

export const dynamic = "force-dynamic";

/**
 * Unauthenticated liveness check for the status page: answers 200 when the
 * database (through Hyperdrive on Workers) responds within 2 s, 503 otherwise.
 * NOW() keeps Hyperdrive from serving the SELECT from its cache.
 */
export function GET() {
  return healthCheck(async () => {
    await db.execute(sql`SELECT NOW()`);
  });
}
