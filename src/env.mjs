import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    WEBHOOK_SECRET: z.string().min(1),
    UNKEY_API_ID: z.string().min(1),
    UNKEY_TOKEN: z.string().min(1),
    REDIS_URL: z.string().min(1).default("redis://localhost:6379/0"),
    UMAMI_TRACKING_ID: z.string().optional(),
    HOST: z.string().min(1).default("http://localhost:3000"),
    VERCEL_URL: z.string().optional(),
    GEOLOCATION_API_KEY: z.string().optional(),
  },

  clientPrefix: "NEXT_PUBLIC_",

  client: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().min(1),
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().min(1),
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().min(1),
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: z.string().min(1),
  },

  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
    UNKEY_API_ID: process.env.UNKEY_API_ID,
    UNKEY_TOKEN: process.env.UNKEY_TOKEN,
    REDIS_URL: process.env.REDIS_URL,
    UMAMI_TRACKING_ID: process.env.UMAMI_TRACKING_ID,
    HOST: process.env.HOST,
    VERCEL_URL: process.env.VERCEL_URL,
    GEOLOCATION_API_KEY: process.env.GEOLOCATION_API_KEY,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL:
      process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL,
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL:
      process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL,
  },
});
