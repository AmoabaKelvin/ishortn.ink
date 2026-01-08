import { z } from "zod";

/**
 * Validates that a URL is well-formed and not pointing to ishortn.ink
 * This prevents circular redirects when creating QR codes
 */
export function isValidUrlAndNotIshortn(url: string) {
  const urlSchema = z.string().url();
  const isValidUrl = urlSchema.safeParse(url);
  return isValidUrl.success && !isValidUrl.data.includes("ishortn.ink");
}
