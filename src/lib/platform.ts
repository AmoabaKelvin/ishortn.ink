import { getCloudflareContext } from "@opennextjs/cloudflare";
import { waitUntil } from "@vercel/functions";

// getCloudflareContext() throws when not running on Cloudflare, so each helper
// tries it first and falls back to the Vercel equivalent.

export function getRequestGeo(request: Request): { country?: string; city?: string } {
  try {
    const { cf } = getCloudflareContext();
    if (cf) return { country: cf.country, city: cf.city };
  } catch {
    // not on Cloudflare; fall through to the Vercel headers
  }
  const city = request.headers.get("x-vercel-ip-city");
  return {
    country: request.headers.get("x-vercel-ip-country") ?? undefined,
    city: city ? decodeURIComponent(city) : undefined,
  };
}

export function getClientIp(request: Request): string | undefined {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    undefined
  );
}

export function runAfterResponse(promise: Promise<unknown>): void {
  try {
    getCloudflareContext().ctx.waitUntil(promise);
  } catch {
    waitUntil(promise);
  }
}
