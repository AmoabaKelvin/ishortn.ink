// Creates or updates the fixed short links that email calls to action use (src/lib/email/links.ts)
// on the given account, with UTM tags in the link's UTM fields and clean destination URLs.
//
//   bun scripts/email/seed-email-links.ts --user <userId>           # dry run
//   bun scripts/email/seed-email-links.ts --user <userId> --write
//
// Needs DATABASE_URL. Destinations use NEXT_PUBLIC_APP_URL (default https://ishortn.ink).
// Idempotent; refuses to write if any alias belongs to another account or is reserved.
//
// --user must be an account on a plan without a monthly event cap (Ultra). Clicks on these links count
// toward that account's usage, so on a capped plan email CTA clicks would stop being recorded once
// the cap is hit, and the account would receive cap alerts and upgrade nudges for this traffic.

import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import { APP_BASE_DOMAIN } from "../../src/lib/constants/domains";
import { ALL_EMAIL_LINKS } from "../../src/lib/email/links";
import { link, reservedAlias, user } from "../../src/server/db/schema";

function parseArgs(argv: string[]) {
  let userId: string | undefined;
  let write = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--user" && argv[i + 1]) {
      userId = argv[++i];
    } else if (arg === "--write") {
      write = true;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }
  if (!userId) throw new Error("Usage: --user <userId> [--write]");
  return { userId, write };
}

async function main() {
  const { userId, write } = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://ishortn.ink").replace(/\/$/, "");
  const domain = APP_BASE_DOMAIN;

  const links = ALL_EMAIL_LINKS;
  const aliases = links.map((l) => l.alias);

  const connection = await mysql.createConnection(databaseUrl);
  try {
    const db = drizzle(connection);

    const [owner] = await db.select({ id: user.id }).from(user).where(eq(user.id, userId));
    if (!owner) throw new Error(`No user ${userId}`);

    const [existing, reserved] = await Promise.all([
      db
        .select({ id: link.id, alias: link.alias, userId: link.userId })
        .from(link)
        .where(and(eq(link.domain, domain), inArray(link.alias, aliases))),
      db
        .select({ alias: reservedAlias.alias })
        .from(reservedAlias)
        .where(and(eq(reservedAlias.domain, domain), inArray(reservedAlias.alias, aliases))),
    ]);

    const conflicts = [
      ...existing.filter((row) => row.userId !== userId).map((row) => `${row.alias} (taken)`),
      ...reserved.map((row) => `${row.alias} (reserved)`),
    ];
    if (conflicts.length) {
      throw new Error(`Aliases unavailable on ${domain}: ${conflicts.join(", ")}`);
    }

    const existingIds = new Map(existing.map((row) => [row.alias, row.id]));
    for (const emailLink of links) {
      const values = {
        name: `Email: ${emailLink.utm.utm_campaign} / ${emailLink.utm.utm_content}`,
        url: `${appUrl}${emailLink.path}`,
        utmParams: emailLink.utm,
      };
      const id = existingIds.get(emailLink.alias);
      console.info(
        `${id ? "update" : "create"} https://${domain}/${emailLink.alias} -> ${values.url}`,
      );
      if (!write) continue;
      if (id) {
        await db.update(link).set(values).where(eq(link.id, id));
      } else {
        await db.insert(link).values({
          ...values,
          alias: emailLink.alias,
          domain,
          userId,
          createdByUserId: userId,
          note: "Email call to action (src/lib/email/links.ts)",
        });
      }
    }

    console.info(
      write
        ? `Done: ${links.length} links. Updated links can serve their old destination until their cache entry expires.`
        : `Dry run: ${links.length} links. Re-run with --write to apply.`,
    );
  } finally {
    await connection.end();
  }
}

await main();
