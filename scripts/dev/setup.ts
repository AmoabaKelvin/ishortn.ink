import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

import { parse as parseEnv } from "dotenv";

// bun run setup [--skip-seed] [--email <email> | --user <clerkUserId>]
// Idempotent: existing .env values are never overwritten.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ENV_PATH = path.join(ROOT, ".env");
const ENV_EXAMPLE_PATH = path.join(ROOT, ".env.example");

const GENERATED_SECRETS = {
  IP_HASH_SECRET: () => crypto.randomBytes(32).toString("hex"),
  VERIFIED_CLICKS_SECRET: () => crypto.randomBytes(32).toString("hex"),
  CRON_SECRET: () => crypto.randomBytes(32).toString("hex"),
  // svix format, so `bun run webhook clerk` can sign with it
  WEBHOOK_SECRET: () => `whsec_${crypto.randomBytes(24).toString("base64")}`,
};

const CLERK_PLACEHOLDERS = ["", "pk_test_", "sk_test_"];

const argv = process.argv.slice(2);

function step(title: string) {
  console.log(`\n> ${title}`);
}

function run(program: string, args: string[], opts: { quiet?: boolean } = {}) {
  return spawnSync(program, args, {
    cwd: ROOT,
    env: process.env,
    stdio: opts.quiet ? "pipe" : "inherit",
  });
}

function fail(message: string): never {
  console.error(`\nerror: ${message}`);
  process.exit(1);
}

function setEnvLine(text: string, key: string, value: string) {
  const line = `${key}='${value}'`;
  const pattern = new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=.*$`, "m");
  if (pattern.test(text)) return text.replace(pattern, line);
  return `${text.replace(/\n*$/, "\n")}${line}\n`;
}

async function ensureEnvFile(): Promise<Record<string, string>> {
  step("Environment file");
  let text: string;
  if (existsSync(ENV_PATH)) {
    text = await readFile(ENV_PATH, "utf8");
    console.log(".env exists, keeping your values");
  } else {
    text = await readFile(ENV_EXAMPLE_PATH, "utf8");
    console.log("created .env from .env.example");
  }

  let parsed = parseEnv(text);
  const generated: string[] = [];
  for (const [key, make] of Object.entries(GENERATED_SECRETS)) {
    if ((parsed[key] ?? "").trim() === "") {
      text = setEnvLine(text, key, make());
      generated.push(key);
    }
  }
  if (generated.length) console.log(`generated ${generated.join(", ")}`);

  parsed = parseEnv(text);
  const pk = parsed.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const sk = parsed.CLERK_SECRET_KEY ?? "";
  if (CLERK_PLACEHOLDERS.includes(pk) || CLERK_PLACEHOLDERS.includes(sk)) {
    console.log(
      [
        "",
        "Clerk keys are not set. Create a free app at https://dashboard.clerk.com,",
        "open API keys, and paste them here (or leave blank and edit .env later).",
      ].join("\n"),
    );
    if (process.stdin.isTTY) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const pkInput = (
        await rl.question("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (pk_test_...): ")
      ).trim();
      const skInput = (await rl.question("CLERK_SECRET_KEY (sk_test_...): ")).trim();
      rl.close();
      if (pkInput) text = setEnvLine(text, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", pkInput);
      if (skInput) text = setEnvLine(text, "CLERK_SECRET_KEY", skInput);
    }
  }

  await writeFile(ENV_PATH, text);
  parsed = parseEnv(text);
  for (const [key, value] of Object.entries(parsed)) process.env[key] ??= value;
  return parsed;
}

function checkDocker(): boolean {
  step("Docker");
  if (run("docker", ["info"], { quiet: true }).status !== 0) {
    console.log("docker is not running or not installed; skipping the compose stack");
    return false;
  }
  if (run("docker", ["compose", "version"], { quiet: true }).status !== 0) {
    fail("docker compose v2 is required (docker compose version)");
  }
  return true;
}

function startStack(env: Record<string, string>) {
  step(`Starting MySQL${env.R2_ENDPOINT ? " and MinIO" : ""}`);
  const args = ["compose"];
  if (env.R2_ENDPOINT) args.push("--profile", "storage");
  // --remove-orphans: containers from the old docker/ compose file
  args.push("up", "-d", "--wait", "--remove-orphans");
  if (run("docker", args).status !== 0) {
    fail(
      "docker compose failed. If a port is already in use, set DB_PORT (and MINIO_PORT) in .env " +
        "and update DATABASE_URL to match.",
    );
  }
}

function pushSchema() {
  step("Applying schema");
  // drizzle/ was generated against the Prisma-era production database and does
  // not replay on an empty one, so local uses push and db:migrate is deploy-only.
  if (run("bun", ["run", "db:push"]).status !== 0) {
    fail("schema push failed. Check DATABASE_URL in .env and that MySQL is reachable.");
  }
}

function seed() {
  step("Seeding sample data");
  const args = ["scripts/dev/seed.ts"];
  for (const name of ["--email", "--user"]) {
    const value = argv[argv.indexOf(name) + 1];
    if (argv.includes(name) && value) args.push(name, value);
  }
  if (run("bun", args).status !== 0) fail("seeding failed");
}

function summary(env: Record<string, string>, dockerAvailable: boolean) {
  const appUrl = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  console.log(
    [
      "",
      "Ready.",
      "",
      `  bun dev                      start the app at ${appUrl}`,
      "  bun run webhook clerk user.created",
      "                               replay a signed Clerk webhook against it",
      "  bun run cron cleanup-expired trigger a cron route with the CRON_SECRET bearer",
      "  bun run db:studio            browse the database",
      "",
      "Sign in with any name+clerk_test@example.com address; the verification code is 424242.",
      dockerAvailable
        ? ""
        : "Docker was unavailable: start MySQL yourself and re-run `bun run setup`.",
    ].join("\n"),
  );
}

async function main() {
  const env = await ensureEnvFile();
  const dockerAvailable = checkDocker();
  if (dockerAvailable) startStack(env);
  pushSchema();
  if (!argv.includes("--skip-seed")) seed();
  summary(env, dockerAvailable);
}

void main();
