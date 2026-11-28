import { env } from "@/env.mjs";
import { describeVisitor } from "@/lib/core/analytics/visitor";
import { enqueueClickEvent } from "@/server/lib/click-queue";

type RecordBioPageViewOptions = {
  headers: Headers;
  bioPageId: number;
  /** Bio page owner whose monthly event quota the view consumes. */
  ownerId: string;
  ip: string;
  country: string;
  city: string;
  /**
   * The bio page's `document.referrer`, sent by the view beacon. The beacon
   * request's own Referer header is the bio page itself.
   */
  referrer: string | null;
};

export async function recordBioPageView(opts: RecordBioPageViewOptions): Promise<void> {
  const { headers, bioPageId, ownerId, ip, country, city, referrer } = opts;
  const visitor = await describeVisitor({
    headers,
    ip,
    country,
    city,
    referrer,
    ipHashSecret: env.IP_HASH_SECRET,
  });
  if (!visitor) return;

  await enqueueClickEvent({
    kind: "bio",
    id: crypto.randomUUID(),
    bioPageId,
    ownerId,
    ...visitor,
  });
}
