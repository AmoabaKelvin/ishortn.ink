import { getCloudflareEnv } from "@/lib/platform";

import type { ClickEvent } from "@/lib/core/analytics/click-event";

// Long enough for the click a verify beacon refers to to have been written
// (batches flush within max_batch_timeout, see wrangler.jsonc).
const VERIFY_DELAY_SECONDS = 60;

export async function enqueueClickEvent(event: ClickEvent): Promise<void> {
  // `next dev` emulates the queue binding but runs no consumer, so write inline there.
  const isLocalhost = process.env.NODE_ENV === "development";
  const queue = isLocalhost ? null : (await getCloudflareEnv())?.CLICK_QUEUE;
  if (queue) {
    await queue.send(event, {
      contentType: "json",
      delaySeconds: event.kind === "verify" ? VERIFY_DELAY_SECONDS : undefined,
    });
    return;
  }
  // Imported lazily so the queue path doesn't load the db client: the worker's
  // cached redirect enqueues clicks outside the Next bundle.
  const { ingestClickBatch } = await import("./click-ingest");
  await ingestClickBatch([event]);
}
