// Deploy step: writes every drizzle migration into the migrator Worker's bundle
// (workers/migrator/src/migrations.ts) so it can apply them through Hyperdrive.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import { z } from "zod";

import { type Migration, splitStatements } from "./safety";

const journal = z
  .object({ entries: z.array(z.object({ tag: z.string(), when: z.number() })) })
  .parse(JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")));

const migrations: Migration[] = journal.entries.map(({ tag, when }) => {
  const sql = readFileSync(`drizzle/${tag}.sql`, "utf8");
  return {
    tag,
    when,
    hash: createHash("sha256").update(sql).digest("hex"),
    statements: splitStatements(sql),
  };
});

writeFileSync(
  "workers/migrator/src/migrations.ts",
  `// Generated at deploy time by scripts/migrations/bundle.ts; the committed copy is empty.\nimport type { Migration } from "../../../scripts/migrations/safety";\n\nexport const MIGRATIONS: Migration[] = ${JSON.stringify(migrations)};\n`,
);
console.log(`Bundled ${migrations.length} migrations, latest ${migrations.at(-1)?.tag ?? "none"}`);
