import "dotenv/config";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// bun run preview: OpenNext build + wrangler dev, with crons triggerable via
// GET /__scheduled?cron=<expr>.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Wrangler refuses to emulate Hyperdrive without a local connection string.
process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE ??= process.env.DATABASE_URL;

for (const args of [
  ["opennextjs-cloudflare", "build"],
  ["opennextjs-cloudflare", "preview", "--", "--test-scheduled"],
]) {
  const result = spawnSync("bunx", args, { cwd: ROOT, env: process.env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
