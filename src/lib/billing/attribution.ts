/**
 * Where an upgrade came from: the pricing-page `source` param plus the campaign's UTM tags. It
 * rides from /pricing through sign-up to /dashboard/pricing as query params, then into the
 * checkout's custom data so the order webhook can report the same values.
 */
export const ATTRIBUTION_PARAMS = [
  "source",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

export type AttributionParam = (typeof ATTRIBUTION_PARAMS)[number];
export type Attribution = {
  source?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
};

// Matches the `CheckoutStart.source` column, so a carried value is never cut off on write.
export const ATTRIBUTION_VALUE_MAX_LENGTH = 64;

type AttributionSource = { get(key: AttributionParam): string | null | undefined };

/** The attribution params present in a query string, trimmed and capped; blanks are dropped. */
export function readAttribution(params: AttributionSource | null): Attribution {
  const attribution: Attribution = {};
  if (!params) return attribution;
  for (const key of ATTRIBUTION_PARAMS) {
    const value = params.get(key)?.trim().slice(0, ATTRIBUTION_VALUE_MAX_LENGTH);
    if (value) attribution[key] = value;
  }
  return attribution;
}

/** Appends the attribution to a path's query string. */
export function withAttribution(path: string, attribution: Attribution): string {
  const [pathname = "", query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  for (const key of ATTRIBUTION_PARAMS) {
    const value = attribution[key];
    if (value) params.set(key, value);
  }
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}

/**
 * The single source a checkout is logged under: an in-app prompt's `source`, else the campaign's
 * `utm_source`, else the fallback for how the checkout was opened.
 */
export function checkoutSource(attribution: Attribution, fallback?: string): string | undefined {
  return attribution.source ?? attribution.utm_source ?? fallback;
}

/** The UTM tags alone, as sent with a checkout next to its single `source`. */
export function utmTags({ source: _source, ...utm }: Attribution): Omit<Attribution, "source"> {
  return utm;
}

/**
 * Lemon Squeezy checkout custom data: the user plus the checkout's attribution and discount code.
 * The provider echoes it in `meta.custom_data` on the order and subscription webhooks.
 */
export function checkoutCustomData(
  userId: string,
  attribution: Attribution,
  discountCode: string | undefined,
): Record<string, string> {
  return checkoutEventProperties({ user_id: userId, ...attribution, discount_code: discountCode });
}

/** PostHog properties for the checkout funnel events, without the values that weren't set. */
export function checkoutEventProperties<T extends string | number | boolean>(
  properties: Record<string, T | null | undefined>,
) {
  return Object.fromEntries(
    Object.entries(properties).filter((entry): entry is [string, T] => {
      const value = entry[1];
      return value !== undefined && value !== null && value !== "";
    }),
  );
}
