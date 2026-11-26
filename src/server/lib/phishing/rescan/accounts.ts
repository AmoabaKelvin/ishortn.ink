import { inArray } from "drizzle-orm";

import { resolvePlan } from "@/lib/billing/plans";
import { db } from "@/server/db";
import { link, subscription } from "@/server/db/schema";

export const WRITE_CHUNK_SIZE = 500;

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** Links owned by a team (always Ultra) or by a user with an entitled subscription. */
export async function loadPayingLinkIds(linkIds: number[]): Promise<Set<number>> {
  const paying = new Set<number>();
  for (const ids of chunk(linkIds, WRITE_CHUNK_SIZE)) {
    const owners = await db
      .select({ id: link.id, userId: link.userId, teamId: link.teamId })
      .from(link)
      .where(inArray(link.id, ids));
    const personal = owners.filter((o) => o.teamId === null);
    for (const o of owners) if (o.teamId !== null) paying.add(o.id);
    if (personal.length === 0) continue;

    const subs = await db
      .select()
      .from(subscription)
      .where(inArray(subscription.userId, [...new Set(personal.map((o) => o.userId))]));
    const paid = new Set(subs.filter((sub) => resolvePlan(sub) !== "free").map((s) => s.userId));
    for (const o of personal) if (paid.has(o.userId)) paying.add(o.id);
  }
  return paying;
}
