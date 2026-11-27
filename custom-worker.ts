// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as handler } from "./.open-next/worker.js";
import { APP_BASE_DOMAIN } from "./src/lib/constants/domains";
import { applyLinkStateStatus } from "./src/lib/routing/link-state";
import { getWwwRedirectUrl } from "./src/lib/routing/www-redirect";

import type { ClickEvent } from "./src/lib/core/analytics/click-event";

type Env = CloudflareEnv & { CRON_SECRET: string };

// Maps each cron expression (see triggers.crons in wrangler.jsonc) to the
// Next.js routes it runs. Hourly jobs share a slot rather than adding cron
// expressions. The routes authenticate with the CRON_SECRET bearer token.
const CRON_ROUTES = new Map([
  ["0 9 * * *", ["/api/cron/domain-reminders"]],
  ["0 0 * * *", ["/api/cron/cleanup-teams"]],
  ["0 2 * * SUN", ["/api/cron/cleanup-analytics"]],
  ["0 4 * * *", ["/api/cron/cleanup-expired"]],
  ["0 5 * * *", ["/api/cron/entitlements"]],
  ["0 7 * * *", ["/api/cron/link-health"]],
  ["25 * * * *", ["/api/cron/entitlements?emails=1"]],
  ["30 */6 * * *", ["/api/cron/phishing-rescan"]],
  ["5,20,35,50 * * * *", ["/api/cron/phishing-rescan?backlog=1"]],
  [
    "10 * * * *",
    [
      "/api/cron/api-access-sunset",
      "/api/cron/first-link-nudge",
      "/api/cron/promo-paused-notice",
      "/api/cron/scheduled-reports",
      "/api/cron/upgrade-nudge",
    ],
  ],
  ["40 * * * *", ["/api/cron/link-creation-health"]],
  ["0 9-17 * * MON", ["/api/cron/weekly-summary"]],
]);

// The queue consumer lives in a Next.js route so it shares the app's DB setup.
const CLICK_QUEUE_ROUTE = "/api/queue/clicks";
const BATCH_RETRY_SECONDS = 30;

function callApp(env: Env, path: string, body?: ClickEvent[]): Promise<Response> {
  const self = env.WORKER_SELF_REFERENCE;
  if (!self) throw new Error("WORKER_SELF_REFERENCE binding missing");
  const headers = new Headers({ Authorization: `Bearer ${env.CRON_SECRET}` });
  if (body === undefined) {
    return self.fetch(`https://${APP_BASE_DOMAIN}${path}`, { method: "GET", headers });
  }
  headers.set("content-type", "application/json");
  return self.fetch(`https://${APP_BASE_DOMAIN}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

export default {
  fetch(request, env, ctx) {
    const wwwRedirect = getWwwRedirectUrl(request.url);
    if (wwwRedirect) return Response.redirect(wwwRedirect, 301);
    const render = (req: Request): Promise<Response> => handler.fetch(req, env, ctx);
    return render(request).then((response) => applyLinkStateStatus(request, response, render));
  },

  async scheduled(controller, env) {
    const paths = CRON_ROUTES.get(controller.cron);
    if (!paths) {
      console.error(`No cron route mapped for schedule "${controller.cron}"`);
      return;
    }
    await Promise.all(
      paths.map(async (path) => {
        const response = await callApp(env, path);
        if (!response.ok) {
          console.error(`Cron ${path} failed: ${response.status} ${await response.text()}`);
        }
      }),
    );
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
