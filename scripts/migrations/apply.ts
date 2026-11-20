// Deploy step: asks the migrator Worker to apply pending migrations and fails
// the deploy when it refuses (dangerous SQL, drift) or a statement errors.
//   bun scripts/migrations/apply.ts [status|apply]
import { createHmac } from "node:crypto";

import { z } from "zod";

const key = process.env.MIGRATE_KEY;
const url = process.env.MIGRATOR_URL;
if (!key || !url) throw new Error("MIGRATE_KEY and MIGRATOR_URL are required");

const action = process.argv[2] === "status" ? "status" : "apply";
const allowDangerous = process.env.ALLOW_DANGEROUS_MIGRATIONS === "true" ? "1" : "0";

const reply = z.object({ ok: z.boolean(), message: z.string().optional() });

// A just-deployed Worker can take a few seconds to answer everywhere.
let response: Response | undefined;
for (let attempt = 1; attempt <= 6; attempt++) {
  const timestamp = String(Date.now());
  const signature = createHmac("sha256", key)
    .update(`${timestamp}.${action}.${allowDangerous}`)
    .digest("hex");
  response = await fetch(url, {
    method: "POST",
    headers: {
      "x-migrate-timestamp": timestamp,
      "x-migrate-signature": signature,
      "x-migrate-action": action,
      "x-migrate-allow-dangerous": allowDangerous,
    },
  });
  if (response.status !== 404 && response.status !== 503) break;
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
if (!response) throw new Error("no response from the migrator");

const text = await response.text();
// Only the migrator's JSON is worth printing; anything else is an error page.
console.log(
  text.trim().startsWith("{")
    ? text
    : `HTTP ${response.status} (${text.length} bytes, not from the migrator)`,
);
const parsed = reply.safeParse(JSON.parse(text.trim().startsWith("{") ? text : "null"));
if (!response.ok || !parsed.success || !parsed.data.ok) {
  const reason = parsed.success
    ? (parsed.data.message ?? `HTTP ${response.status}`)
    : `HTTP ${response.status}: ${text.slice(0, 200)}`;
  console.error(`::error::Migrations ${action} failed: ${reason}`);
  process.exit(1);
}
