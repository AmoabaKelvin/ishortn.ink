import { env } from "@/env.mjs";

// Kept out of @/lib/utils: that module is imported by client components, and @/env.mjs would
// put zod and t3-env in their bundles.
export function absoluteUrl(path: string) {
  return new URL(path, env.NEXT_PUBLIC_APP_URL).href;
}
