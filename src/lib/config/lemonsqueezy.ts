import { lemonSqueezySetup } from "@lemonsqueezy/lemonsqueezy.js";

import { env } from "@/env.mjs";

export function configureLemonSqueezy() {
  const missing = (
    ["LEMONSQUEEZY_API_KEY", "LEMONSQUEEZY_STORE_ID", "LEMONSQUEEZY_WEBHOOK_SECRET"] as const
  ).filter((name) => !env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required LEMONSQUEEZY env variables: ${missing.join(", ")}. Please, set them in your .env file.`,
    );
  }

  lemonSqueezySetup({ apiKey: env.LEMONSQUEEZY_API_KEY });
}
