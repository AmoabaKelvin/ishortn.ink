import { and, eq, getTableColumns, inArray, isNull, or, sql } from "drizzle-orm";
import { unionAll } from "drizzle-orm/mysql-core";

import { buildCacheKey } from "@/lib/core/cache";
import { normalizeAlias } from "@/lib/utils";
import { link, linkPreviousAddress } from "@/server/db/schema";

import { reserveLinkAliases } from "./reserved-alias";

import type { db } from "@/server/db";
import type { Link } from "@/server/db/schema";
import type { SQL } from "drizzle-orm";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbClient = typeof db | TransactionClient;

const normalizeDomain = (domain: string) => domain.trim().toLowerCase();

/**
 * The link answering on domain/alias: its current address or one it moved away
 * from. One round trip, so the redirect path still makes a single lookup.
 */
export async function findLinkByAddress(
  dbClient: DbClient,
  domain: string,
  alias: string,
): Promise<Link | null> {
  const current = dbClient
    .select()
    .from(link)
    .where(and(eq(link.domain, domain), sql`lower(${link.alias}) = lower(${alias})`));
  const previous = dbClient
    .select(getTableColumns(link))
    .from(linkPreviousAddress)
    .innerJoin(link, eq(link.id, linkPreviousAddress.linkId))
    .where(
      and(
        eq(linkPreviousAddress.domain, normalizeDomain(domain)),
        eq(linkPreviousAddress.alias, normalizeAlias(alias)),
      ),
    );
  // Both halves can't match: an address is either current or previous, never both
  // (checkAliasAvailability rejects previous addresses of other links).
  const [found] = await unionAll(current, previous).limit(1);
  return found ?? null;
}

/** True when `link` was found through an address it has since moved away from. */
export function isPreviousAddressOf(
  found: Pick<Link, "domain" | "alias">,
  domain: string,
  alias: string,
): boolean {
  return (
    normalizeDomain(found.domain) !== normalizeDomain(domain) ||
    normalizeAlias(found.alias ?? "") !== normalizeAlias(alias)
  );
}

/**
 * Cache keys of the link's previous addresses. Edits and deletes from the dashboard
 * and API evict these so the owner's change shows on old URLs at once; other
 * writers rely on their short TTL (see resolveLink).
 */
export async function previousAddressCacheKeys(
  dbClient: DbClient,
  linkId: number,
): Promise<string[]> {
  const rows = await dbClient
    .select({ domain: linkPreviousAddress.domain, alias: linkPreviousAddress.alias })
    .from(linkPreviousAddress)
    .where(eq(linkPreviousAddress.linkId, linkId));
  return rows.map((row) => buildCacheKey(row.domain, row.alias));
}

type LinkAddress = { domain: string; alias: string };

/**
 * Bookkeeping for a link changing address, run in the same transaction as, and
 * before, the update. A domain move keeps the old address redirecting to the
 * link; a rename on the same domain retires the old alias like a delete does.
 * Moving back onto one of the link's own previous addresses makes it current again.
 */
export async function recordAddressChange(
  tx: DbClient,
  linkId: number,
  from: LinkAddress,
  to: LinkAddress,
): Promise<void> {
  const movesDomain = normalizeDomain(from.domain) !== normalizeDomain(to.domain);
  const renames = normalizeAlias(from.alias) !== normalizeAlias(to.alias);
  if (!movesDomain && !renames) return;

  await tx
    .delete(linkPreviousAddress)
    .where(
      and(
        eq(linkPreviousAddress.linkId, linkId),
        eq(linkPreviousAddress.domain, normalizeDomain(to.domain)),
        eq(linkPreviousAddress.alias, normalizeAlias(to.alias)),
      ),
    );

  if (movesDomain) {
    await tx
      .insert(linkPreviousAddress)
      .ignore()
      .values({
        linkId,
        domain: normalizeDomain(from.domain),
        alias: normalizeAlias(from.alias),
      });
  } else {
    await reserveLinkAliases(tx, eq(link.id, linkId), "deleted");
  }
}

/**
 * Frees the previous addresses on a custom domain that its workspace is removing:
 * those of the workspace's links (`ownedBy`, a filter on `link`) and of links
 * already deleted. Otherwise whoever adds the hostname next would find those
 * aliases taken and redirecting to the old owner's links. Returns the cache keys
 * to evict once the transaction commits.
 */
export async function releasePreviousAddressesOnDomain(
  tx: DbClient,
  domain: string,
  ownedBy: SQL | undefined,
): Promise<string[]> {
  const rows = await tx
    .select({
      id: linkPreviousAddress.id,
      domain: linkPreviousAddress.domain,
      alias: linkPreviousAddress.alias,
    })
    .from(linkPreviousAddress)
    .leftJoin(link, eq(link.id, linkPreviousAddress.linkId))
    .where(
      and(eq(linkPreviousAddress.domain, normalizeDomain(domain)), or(isNull(link.id), ownedBy)),
    );
  if (rows.length === 0) return [];

  await tx.delete(linkPreviousAddress).where(
    inArray(
      linkPreviousAddress.id,
      rows.map((row) => row.id),
    ),
  );
  return rows.map((row) => buildCacheKey(row.domain, row.alias));
}
