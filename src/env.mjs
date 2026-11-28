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
    // Bearer the Worker sends to /api/cron/* and /api/queue/*
    CRON_SECRET: z.string().optional(),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    RESEND_API_KEY: z.string().optional(),
    // Sender for transactional email; must be on a domain verified in Resend
    EMAIL_FROM: z.string().optional(),
    // Sender for lifecycle email (weekly summary, upgrade nudge), on a separate sending subdomain
    // from EMAIL_FROM. Unset: those jobs send nothing.
    EMAIL_FROM_LIFECYCLE: z.string().optional(),
    // Sender for system notices (cap alerts, plan grace, domain, team and account emails)
    EMAIL_FROM_SYSTEM: z.string().optional(),
    // Monitored inbox that replies to every product email go to
    EMAIL_REPLY_TO: z.string().email().optional(),
    WEBHOOK_SECRET: z.string().optional(),
    // Resend webhook signing secret (svix whsec_…) for /api/webhooks/resend
    RESEND_WEBHOOK_SECRET: z.string().optional(),
    UMAMI_TRACKING_ID: z.string().optional(),
    UMAMI_URL: z.string().url().optional(),
    DISCORD_WEBHOOK_URL: z.string().url().optional(),
    // Google Safe Browsing & Web Risk (same key, Web Risk requires billing enabled)
    GOOGLE_SAFE_BROWSING_API_KEY: z.string().optional(),
    // abuse.ch Auth-Key for the URLhaus feed in the phishing rescan (skipped when unset)
    URLHAUS_AUTH_KEY: z.string().optional(),
    // Cloudflare R2 Storage (S3-compatible)
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET_NAME: z.string().optional(),
    R2_PUBLIC_URL: z.string().url().optional(),
    // Local S3 stand-in (MinIO) instead of R2
    R2_ENDPOINT: z.string().url().optional(),
    // Cloudflare for SaaS custom hostnames
    CLOUDFLARE_API_TOKEN: z.string().optional(),
    CLOUDFLARE_SAAS_ZONE_ID: z.string().optional(),
    CUSTOM_DOMAIN_CNAME_TARGET: z.string().default("cname.ishortn.ink"),
    // Lemon Squeezy billing
    LEMONSQUEEZY_API_KEY: z.string().optional(),
    LEMONSQUEEZY_STORE_ID: z.string().optional(),
    LEMONSQUEEZY_WEBHOOK_SECRET: z.string().optional(),
    // Paddle Billing (src/lib/paddle/config.ts). Paddle stays off unless the key, webhook secret,
    // client token and the four sellable price IDs are all set and match PADDLE_ENVIRONMENT.
    BILLING_PROVIDER: z.enum(["lemonsqueezy", "paddle"]).default("lemonsqueezy"),
    PADDLE_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
    PADDLE_API_KEY: z.string().optional(),
    PADDLE_WEBHOOK_SECRET: z.string().optional(),
    // Read on the server and passed to the checkout page; not a NEXT_PUBLIC_ var
    PADDLE_CLIENT_TOKEN: z.string().optional(),
    PADDLE_PRICE_PRO_MONTHLY: z.string().optional(),
    PADDLE_PRICE_PRO_ANNUAL: z.string().optional(),
    PADDLE_PRICE_ULTRA_MONTHLY: z.string().optional(),
    PADDLE_PRICE_ULTRA_ANNUAL: z.string().optional(),
    // Recognised in webhooks as Pro monthly, never offered at checkout
    PADDLE_PRICE_PRO_LEGACY_MONTHLY: z.string().optional(),
    // Comma-separated user IDs that check out with Paddle while BILLING_PROVIDER is lemonsqueezy
    PADDLE_CHECKOUT_USER_IDS: z.string().optional(),
    // Read by @ai-sdk/openai directly
    OPENAI_API_KEY: z.string().optional(),
    // Secret key used to HMAC visitor IPs before storage.
    // Optional for backwards compatibility — when unset, we fall back to plain
    // SHA-256, which preserves old behavior but is trivially reversible.
    IP_HASH_SECRET: z.string().min(16).optional(),
    // Secret key used to HMAC-sign verified-click tokens issued to destination-page
    // beacons. Optional: when unset, tokens are not issued and no verification
    // events are accepted — the feature is effectively disabled.
    VERIFIED_CLICKS_SECRET: z.string().min(32).optional(),
    // Signs one-click unsubscribe links in notification emails. Unset: those emails carry only a
    // mailto List-Unsubscribe and the settings link in the footer.
    EMAIL_UNSUBSCRIBE_SECRET: z.string().min(32).optional(),
    // Public status API (OpenStatus, Better Stack or Statuspage-compatible) for the footer badge.
    // Unset: the footer shows a plain "Status" link with no uptime claim.
    STATUS_PAGE_API_URL: z.string().url().optional(),
    // Bearer for GET /api/health/deep. Unset: the endpoint answers 503 "not configured".
    HEALTHCHECK_TOKEN: z.string().optional(),
    // Inlined at build time by next.config.js; reported by /api/health/deep.
    BUILD_COMMIT_SHA: z.string().optional(),
    // Comma-separated redirect URIs the browser extension connect page may send a token to, matched
    // exactly (https://<extension-id>.chromiumapp.org/, https://<hash>.extensions.allizom.org/).
    // Unset: /extension/connect refuses every request.
    EXTENSION_REDIRECT_URIS: z.string().optional(),
    // Tests only: overrides the API access sunset that the api-access-sunset cron
    // stores in the ApiAccessSunset table. Leave unset in every deployed environment.
    API_FREE_ACCESS_SUNSET_AT: z
      .string()
      .refine(
        (value) => !Number.isNaN(Date.parse(value)),
        "API_FREE_ACCESS_SUNSET_AT must be a parseable date",
      )
      .optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
    NEXT_PUBLIC_APP_URL: z.string().url(),
    // Host of the dashboard and marketing site (read by src/lib/constants/domains.ts)
    NEXT_PUBLIC_APP_DOMAIN: z.string().optional(),
    // Comma-separated short-link domains, default first (read by src/lib/constants/domains.ts)
    NEXT_PUBLIC_PLATFORM_DOMAINS: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
    // Optional ISO date shown in the custom-domain migration notice
    NEXT_PUBLIC_DOMAIN_MIGRATION_DEADLINE: z
      .string()
      .refine(
        (value) => !Number.isNaN(Date.parse(value)),
        "NEXT_PUBLIC_DOMAIN_MIGRATION_DEADLINE must be a parseable date",
      )
      .optional(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    // Server-side env vars
    DATABASE_URL: process.env.DATABASE_URL,
    CRON_SECRET: process.env.CRON_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_FROM_LIFECYCLE: process.env.EMAIL_FROM_LIFECYCLE,
    EMAIL_FROM_SYSTEM: process.env.EMAIL_FROM_SYSTEM,
    EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
    WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
    RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET,
    UMAMI_TRACKING_ID: process.env.UMAMI_TRACKING_ID,
    UMAMI_URL: process.env.UMAMI_URL,
    DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
    // Google Safe Browsing & Web Risk
    GOOGLE_SAFE_BROWSING_API_KEY: process.env.GOOGLE_SAFE_BROWSING_API_KEY,
    URLHAUS_AUTH_KEY: process.env.URLHAUS_AUTH_KEY,
    // Cloudflare R2 Storage
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
    R2_ENDPOINT: process.env.R2_ENDPOINT,
    // Cloudflare for SaaS custom hostnames
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_SAAS_ZONE_ID: process.env.CLOUDFLARE_SAAS_ZONE_ID,
    CUSTOM_DOMAIN_CNAME_TARGET: process.env.CUSTOM_DOMAIN_CNAME_TARGET,
    LEMONSQUEEZY_API_KEY: process.env.LEMONSQUEEZY_API_KEY,
    LEMONSQUEEZY_STORE_ID: process.env.LEMONSQUEEZY_STORE_ID,
    LEMONSQUEEZY_WEBHOOK_SECRET: process.env.LEMONSQUEEZY_WEBHOOK_SECRET,
    BILLING_PROVIDER: process.env.BILLING_PROVIDER,
    PADDLE_ENVIRONMENT: process.env.PADDLE_ENVIRONMENT,
    PADDLE_API_KEY: process.env.PADDLE_API_KEY,
    PADDLE_WEBHOOK_SECRET: process.env.PADDLE_WEBHOOK_SECRET,
    PADDLE_CLIENT_TOKEN: process.env.PADDLE_CLIENT_TOKEN,
    PADDLE_PRICE_PRO_MONTHLY: process.env.PADDLE_PRICE_PRO_MONTHLY,
    PADDLE_PRICE_PRO_ANNUAL: process.env.PADDLE_PRICE_PRO_ANNUAL,
    PADDLE_PRICE_ULTRA_MONTHLY: process.env.PADDLE_PRICE_ULTRA_MONTHLY,
    PADDLE_PRICE_ULTRA_ANNUAL: process.env.PADDLE_PRICE_ULTRA_ANNUAL,
    PADDLE_PRICE_PRO_LEGACY_MONTHLY: process.env.PADDLE_PRICE_PRO_LEGACY_MONTHLY,
    PADDLE_CHECKOUT_USER_IDS: process.env.PADDLE_CHECKOUT_USER_IDS,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    IP_HASH_SECRET: process.env.IP_HASH_SECRET,
    VERIFIED_CLICKS_SECRET: process.env.VERIFIED_CLICKS_SECRET,
    EMAIL_UNSUBSCRIBE_SECRET: process.env.EMAIL_UNSUBSCRIBE_SECRET,
    STATUS_PAGE_API_URL: process.env.STATUS_PAGE_API_URL,
    HEALTHCHECK_TOKEN: process.env.HEALTHCHECK_TOKEN,
    BUILD_COMMIT_SHA: process.env.BUILD_COMMIT_SHA,
    API_FREE_ACCESS_SUNSET_AT: process.env.API_FREE_ACCESS_SUNSET_AT,
    EXTENSION_REDIRECT_URIS: process.env.EXTENSION_REDIRECT_URIS,
    // Client-side env vars
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_DOMAIN: process.env.NEXT_PUBLIC_APP_DOMAIN,
    NEXT_PUBLIC_PLATFORM_DOMAINS: process.env.NEXT_PUBLIC_PLATFORM_DOMAINS,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_DOMAIN_MIGRATION_DEADLINE: process.env.NEXT_PUBLIC_DOMAIN_MIGRATION_DEADLINE,
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
