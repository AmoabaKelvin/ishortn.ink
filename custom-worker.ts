// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as handler } from "./.open-next/worker.js";

// Maps each cron expression (see triggers.crons in wrangler.jsonc) to the
// Next.js route that Vercel Cron used to call. The routes authenticate with
// the same CRON_SECRET bearer token as before.
const CRON_ROUTES: Record<string, string> = {
  "0 9 * * *": "/api/cron/domain-reminders",
  "0 0 * * *": "/api/cron/cleanup-teams",
  "0 2 * * 0": "/api/cron/cleanup-analytics",
  "0 4 * * *": "/api/cron/cleanup-expired",
};

export default {
  fetch: handler.fetch,

  async scheduled(controller, env, ctx) {
    const path = CRON_ROUTES[controller.cron];
    const self = env.WORKER_SELF_REFERENCE;
    if (!path || !self) {
      console.error(`No cron route mapped for schedule "${controller.cron}"`);
      return;
    }
    const response = await self.fetch(
      `https://ishortn.ink${path}`,
      { headers: { Authorization: `Bearer ${env.CRON_SECRET}` } },
    );
    if (!response.ok) {
      console.error(`Cron ${path} failed: ${response.status} ${await response.text()}`);
    }
  },
} satisfies ExportedHandler<CloudflareEnv & { CRON_SECRET: string }>;
