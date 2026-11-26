import { z } from "zod";

import { clean } from "./clean-value";
import { CLICK_ID_PARAMS, FIRST_TOUCH_MAX_AGE_SECONDS, isDirectTouch } from "./first-touch";

import type { ClickIdType, FirstTouch } from "./first-touch";

// A field of the wrong type is dropped rather than failing the whole cookie.
const cookieString = z.string().optional().catch(undefined);

// z.object strips keys not listed here.
const firstTouchCookieSchema = z.object({
  utm_source: cookieString,
  utm_medium: cookieString,
  utm_campaign: cookieString,
  utm_term: cookieString,
  utm_content: cookieString,
  gclid: cookieString,
  gbraid: cookieString,
  wbraid: cookieString,
  msclkid: cookieString,
  rdt_cid: cookieString,
  fbclid: cookieString,
  li_fat_id: cookieString,
  landingPath: cookieString,
  referrerHost: cookieString,
  ts: z.number().optional().catch(undefined),
});

const firstTouchJson = z
  .string()
  .transform((raw, ctx) => {
    try {
      return JSON.parse(decodeURIComponent(raw));
    } catch {
      ctx.addIssue({ code: "custom", message: "Malformed cookie" });
      return z.NEVER;
    }
  })
  .pipe(firstTouchCookieSchema);

/**
 * Parses an `ish_ft` cookie value (URL-encoded JSON) from an untrusted client.
 * Unknown keys are dropped, strings trimmed to 255 chars, and a missing or
 * implausible timestamp falls back to `now`. Returns null when the value is
 * malformed or carries nothing to attribute (not even a landing path).
 */
export function parseFirstTouch(raw: string, now: Date): FirstTouch | null {
  const parsed = firstTouchJson.safeParse(raw);
  if (!parsed.success) return null;
  const record = parsed.data;

  let clickId: string | null = null;
  let clickIdType: ClickIdType | null = null;
  for (const key of CLICK_ID_PARAMS) {
    const value = clean(record[key]);
    if (value) {
      clickId = value;
      clickIdType = key;
      break;
    }
  }

  const landingPath = clean(record.landingPath);
  const maxAgeMs = FIRST_TOUCH_MAX_AGE_SECONDS * 1000;
  const ts = record.ts;
  const tsIsPlausible = ts !== undefined && ts <= now.getTime() && ts >= now.getTime() - maxAgeMs;

  const touch: FirstTouch = {
    utmSource: clean(record.utm_source),
    utmMedium: clean(record.utm_medium),
    utmCampaign: clean(record.utm_campaign),
    utmTerm: clean(record.utm_term),
    utmContent: clean(record.utm_content),
    clickId,
    clickIdType,
    landingPath: landingPath?.startsWith("/") ? landingPath : null,
    referrerHost: clean(record.referrerHost)?.toLowerCase() ?? null,
    firstSeenAt: tsIsPlausible ? new Date(ts) : now,
  };

  return touch.landingPath || !isDirectTouch(touch) ? touch : null;
}
