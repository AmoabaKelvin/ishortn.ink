import { env } from "@/env.mjs";
import { logger } from "@/lib/logger";

import type { BillingInterval, Plan } from "@/lib/billing/plans";

const log = logger.child({ component: "paddle-config" });

export type PaddleEnvironment = "sandbox" | "production";
export type PaidPlan = Exclude<Plan, "free">;
export type CheckoutProvider = "lemonsqueezy" | "paddle";

export type PaddleEnv = Pick<
  typeof env,
  | "BILLING_PROVIDER"
  | "PADDLE_ENVIRONMENT"
  | "PADDLE_API_KEY"
  | "PADDLE_WEBHOOK_SECRET"
  | "PADDLE_CLIENT_TOKEN"
  | "PADDLE_PRICE_PRO_MONTHLY"
  | "PADDLE_PRICE_PRO_ANNUAL"
  | "PADDLE_PRICE_ULTRA_MONTHLY"
  | "PADDLE_PRICE_ULTRA_ANNUAL"
  | "PADDLE_PRICE_PRO_LEGACY_MONTHLY"
  | "PADDLE_CHECKOUT_USER_IDS"
>;

export type PaddleConfig = {
  environment: PaddleEnvironment;
  apiKey: string;
  webhookSecret: string;
  clientToken: string;
  prices: Record<PaidPlan, Record<BillingInterval, string>>;
  legacyProMonthlyPriceId: string | null;
  forcePaddle: boolean;
  checkoutUserIds: ReadonlySet<string>;
};

const KEY_PREFIXES = {
  sandbox: { apiKey: "pdl_sdbx_", clientToken: "test_" },
  production: { apiKey: "pdl_live_", clientToken: "live_" },
} satisfies Record<PaddleEnvironment, { apiKey: string; clientToken: string }>;

export function buildPaddleConfig(source: PaddleEnv): PaddleConfig | null {
  const apiKey = source.PADDLE_API_KEY;
  const webhookSecret = source.PADDLE_WEBHOOK_SECRET;
  const clientToken = source.PADDLE_CLIENT_TOKEN;
  const proMonthly = source.PADDLE_PRICE_PRO_MONTHLY;
  const proAnnual = source.PADDLE_PRICE_PRO_ANNUAL;
  const ultraMonthly = source.PADDLE_PRICE_ULTRA_MONTHLY;
  const ultraAnnual = source.PADDLE_PRICE_ULTRA_ANNUAL;
  if (
    !apiKey ||
    !webhookSecret ||
    !clientToken ||
    !proMonthly ||
    !proAnnual ||
    !ultraMonthly ||
    !ultraAnnual
  ) {
    return null;
  }

  const environment = source.PADDLE_ENVIRONMENT ?? "sandbox";
  const prefixes = KEY_PREFIXES[environment];
  // A live key against the sandbox API (or the reverse) fails every call; treat it as unconfigured
  // so checkout stays on Lemon Squeezy instead of breaking.
  if (!apiKey.startsWith(prefixes.apiKey) || !clientToken.startsWith(prefixes.clientToken)) {
    log.error(
      {
        environment,
        expectedApiKeyPrefix: prefixes.apiKey,
        expectedTokenPrefix: prefixes.clientToken,
      },
      "Paddle API key or client token does not match PADDLE_ENVIRONMENT; Paddle disabled",
    );
    return null;
  }

  return {
    environment,
    apiKey,
    webhookSecret,
    clientToken,
    prices: {
      pro: { monthly: proMonthly, annual: proAnnual },
      ultra: { monthly: ultraMonthly, annual: ultraAnnual },
    },
    legacyProMonthlyPriceId: source.PADDLE_PRICE_PRO_LEGACY_MONTHLY ?? null,
    forcePaddle: source.BILLING_PROVIDER === "paddle",
    checkoutUserIds: new Set(
      (source.PADDLE_CHECKOUT_USER_IDS ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  };
}

// env is fixed for the life of the isolate, so build (and log a mismatch) once.
let cached: { config: PaddleConfig | null } | undefined;

export function getPaddleConfig(): PaddleConfig | null {
  cached ??= { config: buildPaddleConfig(env) };
  return cached.config;
}

export function checkoutProviderFor(
  userId: string,
  config: PaddleConfig | null = getPaddleConfig(),
): CheckoutProvider {
  if (!config) return "lemonsqueezy";
  return config.forcePaddle || config.checkoutUserIds.has(userId) ? "paddle" : "lemonsqueezy";
}

export function paddlePriceId(
  plan: PaidPlan,
  interval: BillingInterval,
  config: PaddleConfig | null = getPaddleConfig(),
): string | null {
  return config?.prices[plan][interval] ?? null;
}

export function planFromPaddlePrice(
  priceId: string,
  config: PaddleConfig | null = getPaddleConfig(),
): { plan: PaidPlan; interval: BillingInterval } | null {
  if (!config || !priceId) return null;
  if (priceId === config.legacyProMonthlyPriceId) return { plan: "pro", interval: "monthly" };
  for (const plan of ["pro", "ultra"] as const) {
    for (const interval of ["monthly", "annual"] as const) {
      if (config.prices[plan][interval] === priceId) return { plan, interval };
    }
  }
  return null;
}

export function paddleApiBaseUrl(config: PaddleConfig): string {
  return config.environment === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";
}
