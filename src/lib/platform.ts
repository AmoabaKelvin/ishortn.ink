import { getCloudflareContext } from "@opennextjs/cloudflare";

export function getRequestGeo(): { country?: string; city?: string } {
  const { cf } = getCloudflareContext();
  return { country: cf?.country, city: cf?.city };
}

export function getClientIp(headers: Headers): string | undefined {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    undefined
  );
}

export function runAfterResponse(promise: Promise<unknown>): void {
  getCloudflareContext().ctx.waitUntil(promise);
}

/** Bindings from the Cloudflare context; null when running off-platform. */
export async function getCloudflareEnv(): Promise<CloudflareEnv | null> {
  try {
    return (await getCloudflareContext({ async: true })).env;
  } catch {
    return null;
  }
}
