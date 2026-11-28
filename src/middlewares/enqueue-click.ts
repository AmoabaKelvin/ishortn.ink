// Kept free of db, logger and env.mjs imports: the worker's cached redirect
// (cached-redirect.ts) records clicks through this outside the Next bundle.
import { describeVisitor } from "@/lib/core/analytics/visitor";
import { enqueueClickEvent } from "@/server/lib/click-queue";

import type { Link } from "@/lib/core/cache";

type RecordClickOptions = {
  headers: Headers;
  link: Link;
  ip: string;
  country: string;
  city: string;
  /** `IP_HASH_SECRET`, passed in so this module never loads env.mjs. */
  ipHashSecret: string | undefined;
  matchedGeoRuleId?: number;
  /** Set when a verified-click token was issued; the beacon finds the row by it. */
  visitId?: string | null;
};

/** Queues a click. Drops bots here; quota and persistence happen in the consumer. */
export async function recordClick(opts: RecordClickOptions): Promise<void> {
  const { headers, link, ip, country, city, ipHashSecret, matchedGeoRuleId, visitId } = opts;
  const visitor = await describeVisitor({
    headers,
    ip,
    country,
    city,
    isQrCode: link.isQrCode,
    ipHashSecret,
  });
  if (!visitor) return;

  await enqueueClickEvent({
    kind: "link",
    id: visitId ?? crypto.randomUUID(),
    linkId: link.id,
    ownerId: link.userId,
    matchedGeoRuleId: matchedGeoRuleId ?? null,
    countsTowardLimit: !!link.disableLinkAfterClicks,
    ...visitor,
  });
}
