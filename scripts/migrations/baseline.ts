// Self-hosting: marks every migration in drizzle/ as applied on a database
// that `bun run db:push` just built from schema.ts. The migration chain began
// against an existing production database and does not replay on an empty
// one, so new instances start from the schema and record the chain the way
// drizzle's migrator does. After this, `bun run db:migrate` applies only
// migrations added later, and /api/health/deep reports none pending.
//   bun run db:baseline
import "dotenv/config";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import mysql from "mysql2/promise";
import { z } from "zod";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const journal = z
  .object({ entries: z.array(z.object({ tag: z.string(), when: z.number() })) })
  .parse(JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")));

const connection = await mysql.createConnection(url);
try {
  // Same DDL as drizzle-orm's MySQL migrator.
  await connection.query(
    "CREATE TABLE IF NOT EXISTS `__drizzle_migrations` (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)",
  );
  const [rows] = await connection.query("SELECT COUNT(*) AS applied FROM `__drizzle_migrations`");
  const { applied } = z
    .array(z.object({ applied: z.coerce.number() }))
    .length(1)
    .parse(rows)[0]!;
  if (applied > 0) {
    throw new Error(
      `__drizzle_migrations already has ${applied} rows; use \`bun run db:migrate\` instead`,
    );
  }

  for (const { tag, when } of journal.entries) {
    const hash = createHash("sha256")
      .update(readFileSync(`drizzle/${tag}.sql`, "utf8"))
      .digest("hex");
    await connection.query("INSERT INTO `__drizzle_migrations` (hash, created_at) VALUES (?, ?)", [
      hash,
      when,
    ]);
  }
  console.log(
    `Recorded ${journal.entries.length} migrations as applied, latest ${journal.entries.at(-1)?.tag ?? "none"}`,
  );
} finally {
  await connection.end();
}
