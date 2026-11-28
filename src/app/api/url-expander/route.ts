import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/env.mjs";
import { getClientIp } from "@/lib/platform";
import { hashIp } from "@/lib/utils/ip-hash";
import { checkGoogleSafeBrowsing } from "@/server/lib/phishing/google-safe-browsing";
import { checkHttpUrl } from "@/server/lib/ssrf";
import { EXPAND_ERRORS, expandUrl } from "@/server/lib/url-expander/expand";
import { resolveOwnLink } from "@/server/lib/url-expander/own-link";
import { consumeExpanderRateLimit, rateLimitMessage } from "@/server/lib/url-expander/rate-limit";

import type { ExpandResult } from "@/server/lib/url-expander/expand";

const bodySchema = z.object({ url: z.string().max(2048) });

const respond = (result: ExpandResult, status: number, headers?: HeadersInit) =>
  NextResponse.json(result, { status, headers: { "cache-control": "no-store", ...headers } });

export async function POST(request: Request) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return respond({ ok: false, error: EXPAND_ERRORS.notAUrl }, 400);

  const decision = await consumeExpanderRateLimit(
    hashIp(getClientIp(request.headers) ?? "unknown", env.IP_HASH_SECRET),
  );
  if (!decision.allowed) {
    return respond({ ok: false, error: rateLimitMessage(decision.retryAfter) }, 429, {
      "Retry-After": String(decision.retryAfter),
    });
  }

  const result = await expandUrl(body.data.url, {
    fetch: (url, init) => fetch(url, init),
    checkUrl: (url) => checkHttpUrl(url),
    resolveOwnLink,
    checkSafety: checkGoogleSafeBrowsing,
  });
  return respond(result, result.ok ? 200 : 422);
}
