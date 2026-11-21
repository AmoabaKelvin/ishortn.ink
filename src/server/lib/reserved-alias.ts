import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { isPlatformDomain, PLATFORM_DOMAINS } from "@/lib/constants/domains";
import { generateShortLink } from "@/lib/core/links";
import { normalizeAlias } from "@/lib/utils";
import { link, reservedAlias } from "@/server/db/schema";

import type { db } from "@/server/db";
import type { SQL } from "drizzle-orm";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbClient = typeof db | TransactionClient;

export type ReservedAliasReason = (typeof reservedAlias.$inferInsert)["reason"];

/**
 * Tombstones the platform-domain aliases of the links matching `where`, so they
 * can never be claimed by anyone again. Run it in the same transaction as, and
 * before, the statement that deletes or renames those links. Custom-domain
 * aliases are skipped: only the domain's owner can create links there.
 */
export async function reserveLinkAliases(
  tx: DbClient,
  where: SQL | undefined,
  reason: ReservedAliasReason,
): Promise<void> {
  // One INSERT ... SELECT so callers don't need to load the rows first.
  await tx.execute(sql`
    insert ignore into ${reservedAlias}
      (${sql.identifier(reservedAlias.domain.name)}, ${sql.identifier(reservedAlias.alias.name)}, ${sql.identifier(reservedAlias.reason.name)})
    select lower(${link.domain}), lower(${link.alias}), ${reason}
    from ${link}
    where ${and(where, isNotNull(link.alias), inArray(link.domain, [...PLATFORM_DOMAINS]))}
  `);
}

export async function isAliasReserved(
  dbClient: DbClient,
  alias: string,
  domain: string,
): Promise<boolean> {
  const normalizedDomain = domain.trim().toLowerCase();
  if (!isPlatformDomain(normalizedDomain)) return false;

  const [row] = await dbClient
    .select({ id: reservedAlias.id })
    .from(reservedAlias)
    .where(
      and(
        eq(reservedAlias.domain, normalizedDomain),
        eq(reservedAlias.alias, normalizeAlias(alias)),
      ),
    )
    .limit(1);
  return !!row;
}

const MAX_ALIAS_ATTEMPTS = 5;

/** A random alias that isn't tombstoned on `domain`. */
export async function generateUnreservedAlias(dbClient: DbClient, domain: string) {
  for (let attempt = 0; attempt < MAX_ALIAS_ATTEMPTS; attempt++) {
    const alias = await generateShortLink();
    if (!(await isAliasReserved(dbClient, alias, domain))) return alias;
  }
  throw new Error("Could not generate an available alias");
}
