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
    // Serves cached ISR/SSG responses from the routing layer without loading NextServer, which
    // costs up to ~1.8s on a cold isolate. OpenNext runs it after middleware and keys it on the
    // rewritten path, so the custom-domain bio rewrite and Clerk headers still apply. Incompatible
    // with PPR, which the app doesn't use.
    enableCacheInterception: true,
  }),
  // Halves the Worker bundle; see scripts/build/dedupe-server-chunks.ts.
  buildCommand: "bun run build && bun scripts/build/dedupe-server-chunks.ts",
};
