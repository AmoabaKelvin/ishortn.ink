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
};

export async function recordBioPageView(opts: RecordBioPageViewOptions): Promise<void> {
  const { headers, bioPageId, ownerId, ip, country, city } = opts;
  const visitor = await describeVisitor({ headers, ip, country, city });
  if (!visitor) return;

  await enqueueClickEvent({
    kind: "bio",
    id: crypto.randomUUID(),
    bioPageId,
    ownerId,
    ...visitor,
  });
}
