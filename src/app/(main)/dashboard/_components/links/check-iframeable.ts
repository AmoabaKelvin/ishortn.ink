import { z } from "zod";

const iframeableResponseSchema = z.object({ iframeable: z.boolean() });

// Client-side helper for GET /api/links/iframeable.
export async function checkIframeable(url: string, signal: AbortSignal): Promise<boolean> {
  const response = await fetch(`/api/links/iframeable?url=${encodeURIComponent(url)}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return iframeableResponseSchema.parse(await response.json()).iframeable;
}
