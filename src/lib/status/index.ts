import { env } from "@/env.mjs";
import { logger } from "@/lib/logger";

import { statusPayloadSchema } from "./parse";

import type { SystemStatus } from "./parse";

export type { SystemStatus } from "./parse";

const log = logger.child({ component: "system-status" });

// Pages that render the badge regenerate in the background (ISR via the memory queue in
// open-next.config.ts), so this timeout only bounds how long a regeneration waits, never a
// visitor's request.
const FETCH_TIMEOUT_MS = 2000;

export const getSystemStatus = async (): Promise<SystemStatus | null> => {
  if (!env.STATUS_PAGE_API_URL) return null;

  try {
    const response = await fetch(env.STATUS_PAGE_API_URL, {
      headers: { accept: "application/json" },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      log.warn({ status: response.status }, "status provider returned an error");
      return null;
    }
    const parsed = statusPayloadSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch (error) {
    log.warn({ err: error }, "status provider fetch failed");
    return null;
  }
};
