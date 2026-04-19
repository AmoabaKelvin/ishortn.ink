import { z } from "zod";

import { PLATFORM_DOMAINS } from "@/lib/constants/domains";

export function isValidUrlAndNotIshortn(url: string) {
  const urlSchema = z.string().url();
  const result = urlSchema.safeParse(url);
  if (!result.success) return false;
  try {
    const host = new URL(result.data).hostname.toLowerCase();
    return !PLATFORM_DOMAINS.some((platform) => host === platform || host.endsWith(`.${platform}`));
  } catch {
    return false;
  }
}
