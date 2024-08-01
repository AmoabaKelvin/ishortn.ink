import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z
      .string()
      .url()
      .refine(
        (str) => !str.includes("YOUR_DATABASE_URL_HERE"),
        "You forgot to change the default URL",
    ),
    GEOLOCATION_API_KEY: z.string().optional(),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    RESEND_API_KEY: z.string().optional(),
    WEBHOOK_SECRET: z.string().optional(),
    REDIS_URL: z.string().url(),
    UMAMI_TRACKING_ID: z.string().optional(),
    UMAMI_URL: z.string().url().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    // Server-side env vars
    DATABASE_URL: process.env.DATABASE_URL,
    GEOLOCATION_API_KEY: process.env.GEOLOCATION_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
    REDIS_URL: process.env.REDIS_URL,
    UMAMI_TRACKING_ID: process.env.UMAMI_TRACKING_ID,
    UMAMI_URL: process.env.UMAMI_URL,
    // Client-side env vars
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined.
   * `SOME_VAR: z.string()` and `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
