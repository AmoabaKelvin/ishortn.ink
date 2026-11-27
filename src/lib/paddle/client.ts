import "server-only";
import { z } from "zod";

import { getPaddleConfig, paddleApiBaseUrl } from "./config";

import type { PaddleConfig } from "./config";

const REQUEST_TIMEOUT_MS = 15_000;
const DISCOUNT_CACHE_TTL_MS = 10 * 60 * 1000;

export class PaddleApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string;
  readonly requestId: string | null;

  constructor(input: {
    method: string;
    path: string;
    status: number;
    code: string;
    detail: string;
    requestId: string | null;
  }) {
    super(
      `Paddle API ${input.method} ${input.path} failed (${input.status} ${input.code}): ${input.detail}`,
    );
    this.name = "PaddleApiError";
    this.status = input.status;
    this.code = input.code;
    this.detail = input.detail;
    this.requestId = input.requestId;
  }
}

// Only the fields the app reads are parsed; zod objects drop the rest, so new Paddle fields never
// break parsing.
const jsonObjectSchema = z.record(z.string(), z.json());

const transactionSchema = z.object({
  id: z.string(),
  status: z.string(),
  // Paddle returns no checkout URL when the account has no default payment link.
  checkout: z.object({ url: z.string().nullable() }).nullable(),
});

const customerSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
});

const subscriptionSchema = z.object({
  id: z.string(),
  status: z.string(),
  customer_id: z.string(),
  items: z.array(z.object({ price: z.object({ id: z.string() }) })),
  scheduled_change: z
    .object({
      action: z.string(),
      effective_at: z.string(),
      resume_at: z.string().nullable(),
    })
    .nullable(),
  current_billing_period: z.object({ starts_at: z.string(), ends_at: z.string() }).nullable(),
  next_billed_at: z.string().nullable(),
  started_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  custom_data: jsonObjectSchema.nullable(),
});

const portalSessionSchema = z.object({
  urls: z.object({
    general: z.object({ overview: z.string() }),
    subscriptions: z.array(
      z.object({
        id: z.string(),
        cancel_subscription: z.string(),
        update_subscription_payment_method: z.string(),
      }),
    ),
  }),
});

const errorBodySchema = z.object({
  error: z.object({ code: z.string(), detail: z.string() }).optional(),
  meta: z.object({ request_id: z.string() }).optional(),
});

export type PaddleTransaction = z.infer<typeof transactionSchema>;
export type PaddleCustomer = z.infer<typeof customerSchema>;
export type PaddleSubscription = z.infer<typeof subscriptionSchema>;
export type PaddlePortalSession = z.infer<typeof portalSessionSchema>;

export type PaddleItem = { priceId: string; quantity: number };
export type PaddleCustomData = z.infer<typeof jsonObjectSchema>;
type JsonValue = PaddleCustomData[string];
type PaddleRequestBody = Record<string, JsonValue | undefined>;
export type PaddleEffectiveFrom = "immediately" | "next_billing_period";
export type PaddleProrationBillingMode =
  | "prorated_immediately"
  | "prorated_next_billing_period"
  | "full_immediately"
  | "full_next_billing_period"
  | "do_not_bill";

export type CreateTransactionInput = {
  items: PaddleItem[];
  customerId?: string;
  customData?: PaddleCustomData;
  discountId?: string;
  collectionMode: "automatic" | "manual";
};

export type UpdateSubscriptionInput = {
  items?: PaddleItem[];
  prorationBillingMode?: PaddleProrationBillingMode;
  /** `null` removes a pending scheduled change (cancel, pause). */
  scheduledChange?: null;
};

const toPaddleItems = (items: PaddleItem[]) =>
  items.map((item) => ({ price_id: item.priceId, quantity: item.quantity }));

export function createPaddleClient(config: PaddleConfig) {
  const baseUrl = paddleApiBaseUrl(config);
  const discountCache = new Map<string, { id: string | undefined; expiresAt: number }>();

  async function request<T>(
    method: "GET" | "POST" | "PATCH",
    path: string,
    schema: z.ZodType<T>,
    body?: PaddleRequestBody,
    timeoutMs = REQUEST_TIMEOUT_MS,
  ): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...(body && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const json: unknown = await response.json().catch(() => null);
    const envelope = errorBodySchema.safeParse(json);
    const requestId = envelope.data?.meta?.request_id ?? response.headers.get("x-request-id");

    if (!response.ok) {
      throw new PaddleApiError({
        method,
        path,
        status: response.status,
        code: envelope.data?.error?.code ?? "unknown",
        detail: envelope.data?.error?.detail ?? (response.statusText || "Request failed"),
        requestId,
      });
    }

    const parsed = z.object({ data: schema }).safeParse(json);
    if (!parsed.success) {
      throw new PaddleApiError({
        method,
        path,
        status: response.status,
        code: "invalid_response",
        detail: parsed.error.message,
        requestId,
      });
    }
    return parsed.data.data;
  }

  const findCustomerByEmail = async (email: string): Promise<PaddleCustomer | undefined> => {
    const query = new URLSearchParams({ email });
    const customers = await request("GET", `/customers?${query}`, z.array(customerSchema));
    return customers[0];
  };

  return {
    createTransaction: (input: CreateTransactionInput) =>
      request("POST", "/transactions", transactionSchema, {
        items: toPaddleItems(input.items),
        customer_id: input.customerId,
        custom_data: input.customData,
        discount_id: input.discountId,
        collection_mode: input.collectionMode,
      }),

    /** Codes (including unknown ones) are cached for 10 minutes per isolate. */
    findActiveDiscountIdByCode: async (code: string): Promise<string | undefined> => {
      const cached = discountCache.get(code);
      if (cached && cached.expiresAt > Date.now()) return cached.id;

      const query = new URLSearchParams({ code, status: "active" });
      const discounts = await request(
        "GET",
        `/discounts?${query}`,
        z.array(z.object({ id: z.string() })),
      );
      const id = discounts[0]?.id;
      discountCache.set(code, { id, expiresAt: Date.now() + DISCOUNT_CACHE_TTL_MS });
      return id;
    },

    findCustomerByEmail,

    createCustomer: async (input: { email: string; name?: string }): Promise<PaddleCustomer> => {
      try {
        return await request("POST", "/customers", customerSchema, {
          email: input.email,
          name: input.name,
        });
      } catch (error) {
        // Paddle customers are unique per email; reuse the existing one.
        if (error instanceof PaddleApiError && error.code === "customer_already_exists") {
          const existing = await findCustomerByEmail(input.email);
          if (existing) return existing;
        }
        throw error;
      }
    },

    getCustomer: (id: string, options?: { timeoutMs?: number }) =>
      request(
        "GET",
        `/customers/${encodeURIComponent(id)}`,
        customerSchema,
        undefined,
        options?.timeoutMs,
      ),

    getSubscription: (id: string) =>
      request("GET", `/subscriptions/${encodeURIComponent(id)}`, subscriptionSchema),

    updateSubscription: (id: string, input: UpdateSubscriptionInput) =>
      request("PATCH", `/subscriptions/${encodeURIComponent(id)}`, subscriptionSchema, {
        items: input.items && toPaddleItems(input.items),
        proration_billing_mode: input.prorationBillingMode,
        scheduled_change: input.scheduledChange,
      }),

    cancelSubscription: (id: string, effectiveFrom: PaddleEffectiveFrom) =>
      request("POST", `/subscriptions/${encodeURIComponent(id)}/cancel`, subscriptionSchema, {
        effective_from: effectiveFrom,
      }),

    pauseSubscription: (
      id: string,
      input: { effectiveFrom: PaddleEffectiveFrom; resumeAt?: string },
    ) =>
      request("POST", `/subscriptions/${encodeURIComponent(id)}/pause`, subscriptionSchema, {
        effective_from: input.effectiveFrom,
        resume_at: input.resumeAt,
      }),

    /** `effectiveFrom` also accepts an RFC 3339 timestamp. */
    resumeSubscription: (id: string, effectiveFrom: PaddleEffectiveFrom | (string & {})) =>
      request("POST", `/subscriptions/${encodeURIComponent(id)}/resume`, subscriptionSchema, {
        effective_from: effectiveFrom,
      }),

    getUpdatePaymentMethodTransaction: (subscriptionId: string) =>
      request(
        "GET",
        `/subscriptions/${encodeURIComponent(subscriptionId)}/update-payment-method-transaction`,
        transactionSchema.pick({ id: true, checkout: true }),
      ),

    createPortalSession: (customerId: string, subscriptionIds: string[]) =>
      request(
        "POST",
        `/customers/${encodeURIComponent(customerId)}/portal-sessions`,
        portalSessionSchema,
        { subscription_ids: subscriptionIds },
      ),
  };
}

export type PaddleClient = ReturnType<typeof createPaddleClient>;

// One client per isolate so the discount cache is shared across requests.
let cached: { client: PaddleClient | null } | undefined;

/** The Paddle client, or `null` while Paddle isn't configured. */
export function getPaddleClient(): PaddleClient | null {
  if (!cached) {
    const config = getPaddleConfig();
    cached = { client: config ? createPaddleClient(config) : null };
  }
  return cached.client;
}
