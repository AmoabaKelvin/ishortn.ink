// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as handler } from "./.open-next/worker.js";

import type { ClickEvent } from "./src/lib/core/analytics/click-event";

type Env = CloudflareEnv & { CRON_SECRET: string };

// Maps each cron expression (see triggers.crons in wrangler.jsonc) to the
// Next.js route that Vercel Cron used to call. The routes authenticate with
// the same CRON_SECRET bearer token as before.
const CRON_ROUTES = new Map([
  ["0 9 * * *", "/api/cron/domain-reminders"],
  ["0 0 * * *", "/api/cron/cleanup-teams"],
  ["0 2 * * SUN", "/api/cron/cleanup-analytics"],
  ["0 4 * * *", "/api/cron/cleanup-expired"],
]);

// The queue consumer lives in a Next.js route so it shares the app's DB setup.
const CLICK_QUEUE_ROUTE = "/api/queue/clicks";
const BATCH_RETRY_SECONDS = 30;

function callApp(env: Env, path: string, body?: ClickEvent[]): Promise<Response> {
  const self = env.WORKER_SELF_REFERENCE;
  if (!self) throw new Error("WORKER_SELF_REFERENCE binding missing");
  const headers = new Headers({ Authorization: `Bearer ${env.CRON_SECRET}` });
  if (body === undefined) {
    return self.fetch(`https://ishortn.ink${path}`, { method: "GET", headers });
  }
  headers.set("content-type", "application/json");
  return self.fetch(`https://ishortn.ink${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

export default {
  fetch: handler.fetch,

  async scheduled(controller, env) {
    const path = CRON_ROUTES.get(controller.cron);
    if (!path) {
      console.error(`No cron route mapped for schedule "${controller.cron}"`);
      return;
    }
    const response = await callApp(env, path);
    if (!response.ok) {
      console.error(`Cron ${path} failed: ${response.status} ${await response.text()}`);
    }
  },

  async queue(batch, env) {
    const response = await callApp(
      env,
      CLICK_QUEUE_ROUTE,
      batch.messages.map((m) => m.body),
    );
    if (!response.ok) {
      console.error(`Click batch failed: ${response.status} ${await response.text()}`);
      batch.retryAll({ delaySeconds: BATCH_RETRY_SECONDS });
    }
  },
} satisfies ExportedHandler<Env, ClickEvent>;
