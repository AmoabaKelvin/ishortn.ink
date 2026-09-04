import "dotenv/config";

// bun run cron <name> [--url <base>]: calls /api/cron/<name> like custom-worker.ts does.

// Keep in sync with CRON_ROUTES in custom-worker.ts.
const CRON_ROUTES = ["domain-reminders", "cleanup-teams", "cleanup-analytics", "cleanup-expired"];

async function main() {
  const argv = process.argv.slice(2);
  const name = argv[0];
  if (!name || !CRON_ROUTES.includes(name)) {
    console.error(`usage: bun run cron <${CRON_ROUTES.join("|")}> [--url <base>]`);
    process.exit(1);
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("error: CRON_SECRET is not set in .env (run `bun run setup` to generate it)");
    process.exit(1);
  }

  const urlIndex = argv.indexOf("--url");
  const base =
    (urlIndex === -1 ? undefined : argv[urlIndex + 1]) ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  const url = new URL(`/api/cron/${name}`, base).toString();

  console.log(`GET ${url}`);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${secret}` },
  }).catch((err: Error) => {
    console.error(`error: could not reach ${url}: ${err.message}. Is \`bun dev\` running?`);
    process.exit(1);
  });
  const text = await response.text();
  console.log(`${response.status} ${response.statusText}${text ? `\n${text}` : ""}`);
  process.exit(response.ok ? 0 : 1);
}

void main();
