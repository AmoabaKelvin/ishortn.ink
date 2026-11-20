// Shared by the PR check, the deploy step and the migrator Worker: what counts
// as a dangerous migration, and how drizzle splits a migration file.

export type Migration = {
  tag: string;
  /** drizzle's folderMillis from meta/_journal.json; the migrations table stores it as created_at. */
  when: number;
  /** sha256 of the .sql file, the same hash drizzle's migrator records. */
  hash: string;
  statements: string[];
};

// Anything that can lose, rewrite or lock away existing data. Adding tables,
// columns and indexes is safe; everything here needs Kelvin.
const DANGEROUS: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /\bDROP\s+(TABLE|DATABASE|SCHEMA|VIEW|TRIGGER|PROCEDURE|FUNCTION)\b/i,
    reason: "drops a database object",
  },
  { pattern: /\bALTER\s+TABLE\b[\s\S]*\bDROP\b/i, reason: "drops a column, index or key" },
  {
    pattern: /\bALTER\s+TABLE\b[\s\S]*\b(MODIFY|CHANGE)\b/i,
    reason: "changes a column's type or definition",
  },
  {
    pattern: /\bRENAME\s+(TABLE|COLUMN|INDEX|KEY|TO|AS)\b/i,
    reason: "renames something existing code reads",
  },
  { pattern: /\bTRUNCATE\b/i, reason: "empties a table" },
  { pattern: /\bDELETE\s+FROM\b/i, reason: "deletes rows" },
  { pattern: /\bUPDATE\s+`?[\w.]+`?\s+SET\b/i, reason: "rewrites existing rows" },
];

export function splitStatements(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

/** Why each statement is dangerous; empty when the migration only adds things. */
export function dangers(statements: string[]): string[] {
  return statements.flatMap((statement) =>
    DANGEROUS.filter(({ pattern }) => pattern.test(statement)).map(
      ({ reason }) => `${reason}: ${statement.replace(/\s+/g, " ").slice(0, 160)}`,
    ),
  );
}
