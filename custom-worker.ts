// @ts-ignore `.open-next/cloudflare/init.js` is generated at build time
import { runWithCloudflareRequestContext } from "./.open-next/cloudflare/init.js";
// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as handler } from "./.open-next/worker.js";
import { APP_BASE_DOMAIN } from "./src/lib/constants/domains";
import { applyLinkStateStatus } from "./src/lib/routing/link-state";
import { getCachedRedirectTarget } from "./src/lib/routing/short-link-request";
import { getWwwRedirectUrl } from "./src/lib/routing/www-redirect";

import type { ClickEvent } from "./src/lib/core/analytics/click-event";

type Env = CloudflareEnv & { CRON_SECRET: string; IP_HASH_SECRET?: string };

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
  ["5,20,35,50 * * * *", ["/api/cron/phishing-rescan?backlog=1", "/api/cron/webhook-retries"]],
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

// A plain short-link click answered from KV without loading Next, which costs
// ~100ms of CPU per click. Runs in OpenNext's request context so the app's
// cache and queue helpers find their bindings. Null, or any failure, falls
// through to Next.
async function redirectFromCache(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response | null> {
  try {
    return await runWithCloudflareRequestContext(request, env, ctx, async () => {
      const target = getCachedRedirectTarget(request);
      if (!target) return null;
      // Evaluated on first use, so requests that aren't short-link visits never
      // load the visitor parsing it pulls in.
      const cached = await import("./src/middlewares/cached-redirect");
      const redirect = await cached.redirectFromCache(request, target, env.IP_HASH_SECRET);
      if (!redirect) return null;
      ctx.waitUntil(redirect.click.catch((error) => console.error("Failed to queue click", error)));
      return redirect.response;
    });
  } catch (error) {
    console.error("Cached redirect failed, falling back to Next", error);
    return null;
  }
}

export default {
  async fetch(request, env, ctx) {
    const wwwRedirect = getWwwRedirectUrl(request.url);
    if (wwwRedirect) return Response.redirect(wwwRedirect, 301);
    const render = (req: Request): Promise<Response> => handler.fetch(req, env, ctx);
    // A cached redirect goes through the state-route handling too, exactly as
    // the page's redirect would (a destination may be a same-origin state route).
    const response = (await redirectFromCache(request, env, ctx)) ?? (await render(request));
    return applyLinkStateStatus(request, response, render);
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
