// PR check: lists the migrations a branch adds and fails when any is dangerous,
// so the PR shows it up front. Deploys refuse those migrations unless Kelvin
// runs the deploy workflow by hand with allow_dangerous_migrations.
//   bun scripts/migrations/check.ts <base-ref>
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { dangers, splitStatements } from "./safety";

const base = process.argv[2] ?? "origin/main";
const added = execFileSync(
  "git",
  ["diff", "--name-only", "--diff-filter=AM", `${base}...HEAD`, "--", "drizzle/*.sql"],
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean);

if (!added.length) {
  console.log("No migrations in this PR.");
  process.exit(0);
}
let failed = false;
for (const file of added) {
  const found = dangers(splitStatements(readFileSync(file, "utf8")));
  if (found.length) {
    failed = true;
    for (const danger of found)
      console.error(`::error file=${file}::Dangerous migration, ${danger}`);
  } else {
    console.log(`${file}: additive only; applied automatically on deploy.`);
  }
}
process.exit(failed ? 1 : 0);
