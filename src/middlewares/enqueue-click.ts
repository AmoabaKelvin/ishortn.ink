// Kept free of db and logger imports: the worker's cached redirect
// (cached-redirect.ts) records clicks through this outside the Next bundle.
import { describeVisitor } from "@/lib/core/analytics/visitor";
import { generateVisitId } from "@/lib/utils/verified-click-token";
import { enqueueClickEvent } from "@/server/lib/click-queue";

import type { Link } from "@/lib/core/cache";

type RecordClickOptions = {
  headers: Headers;
  link: Link;
  ip: string;
  country: string;
  city: string;
  matchedGeoRuleId?: number;
  /** Set when a verified-click token was issued; the beacon finds the row by it. */
  visitId?: string | null;
};

/** Queues a click. Drops bots here; quota and persistence happen in the consumer. */
export async function recordClick(opts: RecordClickOptions): Promise<void> {
  const { headers, link, ip, country, city, matchedGeoRuleId, visitId } = opts;
  const visitor = await describeVisitor({ headers, ip, country, city });
  if (!visitor) return;

  await enqueueClickEvent({
    kind: "link",
    id: visitId ?? generateVisitId(),
    linkId: link.id,
    ownerId: link.userId,
    matchedGeoRuleId: matchedGeoRuleId ?? null,
    countsTowardLimit: !!link.disableLinkAfterClicks,
    ...visitor,
  });
}
