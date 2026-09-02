import { getCloudflareEnv } from "@/lib/platform";

import { ingestClickBatch } from "./click-ingest";

import type { ClickEvent } from "@/lib/core/analytics/click-event";

// `next dev` emulates the queue binding but runs no consumer, so write inline there.
const isLocalhost = process.env.NODE_ENV === "development";

// Long enough for the click a verify beacon refers to to have been written
// (batches flush within max_batch_timeout, see wrangler.jsonc).
const VERIFY_DELAY_SECONDS = 60;

export async function enqueueClickEvent(event: ClickEvent): Promise<void> {
  const queue = isLocalhost ? null : (await getCloudflareEnv())?.CLICK_QUEUE;
  if (queue) {
    await queue.send(event, {
      contentType: "json",
      delaySeconds: event.kind === "verify" ? VERIFY_DELAY_SECONDS : undefined,
    });
    return;
  }
  await ingestClickBatch([event]);
}
