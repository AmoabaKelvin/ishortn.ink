import { timingSafeEqual } from "node:crypto";

import { env } from "@/env.mjs";
import { logger } from "@/lib/logger";

const log = logger.child({ component: "internal-request" });

/** True when the request carries the CRON_SECRET bearer token the Worker uses to call the app. */
export function isInternalRequest(request: Request): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) {
    log.error("CRON_SECRET environment variable is not set");
    return false;
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return false;
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
