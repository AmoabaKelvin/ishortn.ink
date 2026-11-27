import { describe, expect, test } from "bun:test";

import {
  buildPaddleConfig,
  checkoutProviderFor,
  paddleApiBaseUrl,
  paddlePriceId,
  planFromPaddlePrice,
} from "./config";

import type { PaddleEnv } from "./config";

const EMPTY: PaddleEnv = {
  BILLING_PROVIDER: "lemonsqueezy",
  PADDLE_ENVIRONMENT: "sandbox",
  PADDLE_API_KEY: undefined,
  PADDLE_WEBHOOK_SECRET: undefined,
  PADDLE_CLIENT_TOKEN: undefined,
  PADDLE_PRICE_PRO_MONTHLY: undefined,
  PADDLE_PRICE_PRO_ANNUAL: undefined,
  PADDLE_PRICE_ULTRA_MONTHLY: undefined,
  PADDLE_PRICE_ULTRA_ANNUAL: undefined,
  PADDLE_PRICE_PRO_LEGACY_MONTHLY: undefined,
  PADDLE_CHECKOUT_USER_IDS: undefined,
};

const SANDBOX: PaddleEnv = {
  ...EMPTY,
  PADDLE_API_KEY: "pdl_sdbx_apikey_123",
  PADDLE_WEBHOOK_SECRET: "pdl_ntfset_secret",
  PADDLE_CLIENT_TOKEN: "test_clienttoken",
  PADDLE_PRICE_PRO_MONTHLY: "pri_pro_m",
  PADDLE_PRICE_PRO_ANNUAL: "pri_pro_y",
  PADDLE_PRICE_ULTRA_MONTHLY: "pri_ultra_m",
  PADDLE_PRICE_ULTRA_ANNUAL: "pri_ultra_y",
  PADDLE_PRICE_PRO_LEGACY_MONTHLY: "pri_pro_legacy",
  PADDLE_CHECKOUT_USER_IDS: "user_a, user_b,,",
};

describe("buildPaddleConfig / checkoutProviderFor", () => {
  test("no Paddle env: no config, everyone on Lemon Squeezy", () => {
    const config = buildPaddleConfig(EMPTY);
    expect(config).toBeNull();
    expect(checkoutProviderFor("user_a", config)).toBe("lemonsqueezy");
    expect(buildPaddleConfig({ ...EMPTY, BILLING_PROVIDER: "paddle" })).toBeNull();
  });

  test("full sandbox env: config present, only allowlisted users get Paddle", () => {
    const config = buildPaddleConfig(SANDBOX);
    expect(config).not.toBeNull();
    expect(config?.environment).toBe("sandbox");
    expect(checkoutProviderFor("user_a", config)).toBe("paddle");
    expect(checkoutProviderFor("user_b", config)).toBe("paddle");
    expect(checkoutProviderFor("user_c", config)).toBe("lemonsqueezy");
    expect(checkoutProviderFor("", config)).toBe("lemonsqueezy");
  });

  test("BILLING_PROVIDER=paddle with full env: Paddle for everyone", () => {
    const config = buildPaddleConfig({ ...SANDBOX, BILLING_PROVIDER: "paddle" });
    expect(checkoutProviderFor("user_c", config)).toBe("paddle");
  });

  test("BILLING_PROVIDER=paddle with a missing price stays on Lemon Squeezy", () => {
    for (const key of [
      "PADDLE_PRICE_PRO_MONTHLY",
      "PADDLE_PRICE_PRO_ANNUAL",
      "PADDLE_PRICE_ULTRA_MONTHLY",
      "PADDLE_PRICE_ULTRA_ANNUAL",
      "PADDLE_API_KEY",
      "PADDLE_WEBHOOK_SECRET",
      "PADDLE_CLIENT_TOKEN",
    ] as const) {
      const config = buildPaddleConfig({
        ...SANDBOX,
        BILLING_PROVIDER: "paddle",
        [key]: undefined,
      });
      expect(config).toBeNull();
      expect(checkoutProviderFor("user_a", config)).toBe("lemonsqueezy");
    }
  });

  test("the legacy price is optional", () => {
    const config = buildPaddleConfig({ ...SANDBOX, PADDLE_PRICE_PRO_LEGACY_MONTHLY: undefined });
    expect(config?.legacyProMonthlyPriceId).toBeNull();
  });

  test("key or token from the wrong environment disables Paddle", () => {
    const paddle = { ...SANDBOX, BILLING_PROVIDER: "paddle" as const };
    const liveKey = buildPaddleConfig({ ...paddle, PADDLE_API_KEY: "pdl_live_apikey" });
    expect(liveKey).toBeNull();
    expect(checkoutProviderFor("user_a", liveKey)).toBe("lemonsqueezy");
    expect(buildPaddleConfig({ ...paddle, PADDLE_CLIENT_TOKEN: "live_token" })).toBeNull();
    expect(buildPaddleConfig({ ...paddle, PADDLE_ENVIRONMENT: "production" })).toBeNull();
  });

  test("production env with live credentials", () => {
    const config = buildPaddleConfig({
      ...SANDBOX,
      PADDLE_ENVIRONMENT: "production",
      PADDLE_API_KEY: "pdl_live_apikey",
      PADDLE_CLIENT_TOKEN: "live_token",
    });
    expect(config?.environment).toBe("production");
    expect(config && paddleApiBaseUrl(config)).toBe("https://api.paddle.com");
  });
});

describe("price mapping", () => {
  const config = buildPaddleConfig(SANDBOX);

  test("paddlePriceId returns the sellable price for each plan and interval", () => {
    expect(paddlePriceId("pro", "monthly", config)).toBe("pri_pro_m");
    expect(paddlePriceId("pro", "annual", config)).toBe("pri_pro_y");
    expect(paddlePriceId("ultra", "monthly", config)).toBe("pri_ultra_m");
    expect(paddlePriceId("ultra", "annual", config)).toBe("pri_ultra_y");
    expect(paddlePriceId("pro", "monthly", null)).toBeNull();
  });

  test("planFromPaddlePrice maps every known price back, including legacy", () => {
    expect(planFromPaddlePrice("pri_pro_m", config)).toEqual({ plan: "pro", interval: "monthly" });
    expect(planFromPaddlePrice("pri_pro_y", config)).toEqual({ plan: "pro", interval: "annual" });
    expect(planFromPaddlePrice("pri_ultra_m", config)).toEqual({
      plan: "ultra",
      interval: "monthly",
    });
    expect(planFromPaddlePrice("pri_ultra_y", config)).toEqual({
      plan: "ultra",
      interval: "annual",
    });
    expect(planFromPaddlePrice("pri_pro_legacy", config)).toEqual({
      plan: "pro",
      interval: "monthly",
    });
    expect(planFromPaddlePrice("pri_unknown", config)).toBeNull();
    expect(planFromPaddlePrice("", config)).toBeNull();
    expect(planFromPaddlePrice("pri_pro_m", null)).toBeNull();
  });

  test("the legacy price is never offered at checkout", () => {
    const offered = (["pro", "ultra"] as const).flatMap((plan) =>
      (["monthly", "annual"] as const).map((interval) => paddlePriceId(plan, interval, config)),
    );
    expect(offered).not.toContain("pri_pro_legacy");
  });

  test("sandbox API base URL", () => {
    expect(config && paddleApiBaseUrl(config)).toBe("https://sandbox-api.paddle.com");
  });
});
