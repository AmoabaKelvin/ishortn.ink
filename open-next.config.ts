import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";

export default {
  ...defineCloudflareConfig({
    incrementalCache: kvIncrementalCache,
    // Without a queue OpenNext falls back to its dummy queue, which throws, so time-based ISR
    // (e.g. the landing footer's status badge) would never refresh after deploy. The memory queue
    // revalidates through the WORKER_SELF_REFERENCE binding.
    queue: memoryQueue,
  }),
  // Halves the Worker bundle; see scripts/build/dedupe-server-chunks.ts.
  buildCommand: "bun run build && bun scripts/build/dedupe-server-chunks.ts",
};
