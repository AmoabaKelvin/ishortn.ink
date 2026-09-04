import "dotenv/config";
import crypto from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Webhook } from "svix";

// bun run webhook <clerk|lemonsqueezy> <event> [--user <clerkUserId>] [--email <email>]
// Signs scripts/dev/fixtures/<provider>/<event>.json and POSTs it to the local app.

const FIXTURES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const DEFAULT_USER_ID = "user_local_dev_00000000000000000";
const DEFAULT_EMAIL = "dev+clerk_test@example.com";

type Provider = "clerk" | "lemonsqueezy";

const ROUTES = {
  clerk: "/api/webhooks/clerk",
  lemonsqueezy: "/api/webhooks/lemonsqueezy",
} as const;

function readFlag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}

function usage(message?: string): never {
  if (message) console.error(`error: ${message}\n`);
  console.error(
    [
      "usage: bun run webhook <clerk|lemonsqueezy> <event> [--user <id>] [--email <email>] [--url <base>]",
      "",
      "  --user   Clerk user id substituted for __USER_ID__ (default: the seed dev user)",
      "  --email  email substituted for __EMAIL__ (default: dev+clerk_test@example.com)",
      "  --url    app base URL (default: NEXT_PUBLIC_APP_URL or http://localhost:3000)",
    ].join("\n"),
  );
  process.exit(1);
}

async function listEvents(provider: Provider): Promise<string[]> {
  const entries = await readdir(path.join(FIXTURES_DIR, provider));
  return entries.filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -".json".length));
}

function requireSecret(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`error: ${name} is not set in .env (run \`bun run setup\` to generate it)`);
    process.exit(1);
  }
  return value;
}

function sign(provider: Provider, body: string): Headers {
  const headers = new Headers({ "content-type": "application/json" });
  if (provider === "clerk") {
    const secret = requireSecret("WEBHOOK_SECRET");
    const msgId = `msg_${crypto.randomBytes(12).toString("hex")}`;
    const timestamp = new Date();
    headers.set("svix-id", msgId);
    headers.set("svix-timestamp", String(Math.floor(timestamp.getTime() / 1000)));
    headers.set("svix-signature", new Webhook(secret).sign(msgId, timestamp, body));
  } else {
    const secret = requireSecret("LEMONSQUEEZY_WEBHOOK_SECRET");
    headers.set("X-Signature", crypto.createHmac("sha256", secret).update(body).digest("hex"));
  }
  return headers;
}

async function main() {
  const argv = process.argv.slice(2);
  const [provider, event] = argv;
  if (provider !== "clerk" && provider !== "lemonsqueezy") {
    usage(`unknown provider "${provider ?? ""}"`);
  }
  if (!event) {
    usage(`missing event; available: ${(await listEvents(provider)).join(", ")}`);
  }

  const fixturePath = path.join(FIXTURES_DIR, provider, `${event}.json`);
  const template = await readFile(fixturePath, "utf8").catch(() => null);
  if (template === null) {
    usage(
      `no fixture for ${provider}/${event}; available: ${(await listEvents(provider)).join(", ")}`,
    );
  }

  const now = new Date();
  const body = JSON.stringify(
    JSON.parse(
      template
        .replaceAll("__USER_ID__", readFlag(argv, "--user") ?? DEFAULT_USER_ID)
        .replaceAll("__EMAIL__", readFlag(argv, "--email") ?? DEFAULT_EMAIL)
        .replaceAll("__NOW_ISO__", now.toISOString())
        .replaceAll('"__NOW_MS__"', String(now.getTime())),
    ),
  );

  const base =
    readFlag(argv, "--url") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = new URL(ROUTES[provider], base).toString();
  const headers = sign(provider, body);

  console.log(`POST ${url} (${provider} ${event})`);
  const response = await fetch(url, { method: "POST", headers, body }).catch((err: Error) => {
    console.error(`error: could not reach ${url}: ${err.message}. Is \`bun dev\` running?`);
    process.exit(1);
  });
  const text = await response.text();
  console.log(`${response.status} ${response.statusText}${text ? `\n${text}` : ""}`);
  process.exit(response.ok ? 0 : 1);
}

void main();
