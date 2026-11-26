import { applyApiRateLimit, rateLimitHeaders } from "../v1/rate-limit";
import { authenticateToken } from "../v1/utils";

import type { ApiToken } from "../v1/utils";

// Any origin: auth is a bearer token, never a cookie, so a page that calls these routes gains
// nothing without the token, and the extension needs no host permissions. Firefox extension
// origins are random per install, so an allowlist couldn't name them anyway.
export const EXTENSION_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

/** Every /api/extension error is `{ error, upgradeUrl? }`. */
export function extensionError(
  status: number,
  error: string,
  { upgradeUrl, headers }: { upgradeUrl?: string; headers?: Record<string, string> } = {},
): Response {
  return Response.json(upgradeUrl ? { error, upgradeUrl } : { error }, {
    status,
    headers: { ...EXTENSION_CORS_HEADERS, ...headers },
  });
}

export function extensionPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: { ...EXTENSION_CORS_HEADERS, "Access-Control-Max-Age": "86400" },
  });
}

function bearerToken(request: Request): string | null {
  return request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;
}

/**
 * Wraps an /api/extension route with extension-token auth (API keys are refused, as extension
 * tokens are on /api/v1) and the plan's API rate limit. Cookies are never read.
 */
export function withExtensionToken<Req extends Request, Args extends unknown[]>(
  handler: (request: Req, token: ApiToken, ...args: Args) => Promise<Response>,
) {
  return async (request: Req, ...args: Args): Promise<Response> => {
    const auth = await authenticateToken(bearerToken(request), "extension");
    if (!auth) return extensionError(401, "Not connected. Connect the extension again.");
    const { token } = auth;

    const decision = applyApiRateLimit(await auth.counters, token.plan);
    if (!decision.allowed) {
      return extensionError(
        429,
        `Too many requests. Try again in ${decision.retryAfter} seconds.`,
        {
          headers: { ...rateLimitHeaders(decision), "Retry-After": String(decision.retryAfter) },
        },
      );
    }

    const response = await handler(request, token, ...args);
    for (const [name, value] of Object.entries({
      ...EXTENSION_CORS_HEADERS,
      ...rateLimitHeaders(decision),
    })) {
      response.headers.set(name, value);
    }
    return response;
  };
}
