import { Paths } from "@/lib/constants/app";

import { MAX_URL_LENGTH } from "../_lib/parse-url";

const DEFAULT_CAMPAIGN = "whatsapp-link";

const toolUtm = (campaign: string) =>
  `utm_source=ishortn&utm_medium=tool&utm_campaign=${encodeURIComponent(campaign)}`;

export const featuresSignupHref = (campaign = DEFAULT_CAMPAIGN) =>
  `${Paths.Signup}?${toolUtm(campaign)}&utm_content=features`;

export const FEATURES_SIGNUP_HREF = featuresSignupHref();

// E.164 allows at most 15 digits; nothing real is shorter than 8 with its country code.
const MIN_DIGITS = 8;
const MAX_DIGITS = 15;

// Codes rather than text, so each page shows them in its own language (copy.ts).
export type PhoneError = "too_short" | "too_long" | "invalid_chars" | "no_country";
export type PhoneNote =
  | { code: "dial_already_included"; dial: string }
  | { code: "argentina_mobile" };

export type PhoneResult =
  | { ok: true; digits: string; display: string; notes: PhoneNote[] }
  | { ok: false; error: PhoneError };

const international = (digits: string, notes: PhoneNote[] = []): PhoneResult => {
  if (digits.length < MIN_DIGITS) return { ok: false, error: "too_short" };
  if (digits.length > MAX_DIGITS) return { ok: false, error: "too_long" };
  return { ok: true, digits, display: `+${digits}`, notes };
};

// Brazil's country code 55 is also an area code (DDD) in Rio Grande do Sul, so a national number
// can start with it. National numbers are 10 or 11 digits (DDD + number); with 55 in front, 12 or 13.
const includesDial = (compact: string, dial: string) => {
  if (!compact.startsWith(dial)) return false;
  if (dial === "55") return compact.length === 12 || compact.length === 13;
  return compact.length >= 11;
};

/**
 * The digits wa.me wants (full international number, no `+`, `00` or trunk prefix) from a number
 * typed the way people dial it locally. `dial` is the selected country's calling code, or "" when
 * the visitor says the number already includes it. Empty input gives empty digits and no error.
 */
export const normalizePhone = (input: string, dial: string): PhoneResult => {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, digits: "", display: "", notes: [] };

  const compact = trimmed.replace(/[\s\-.()/]/g, "");
  if (!/^\+?\d*$/.test(compact)) {
    return { ok: false, error: "invalid_chars" };
  }
  if (compact.startsWith("+")) return international(compact.slice(1));
  if (compact.startsWith("00")) return international(compact.slice(2));
  if (!dial) return { ok: false, error: "no_country" };

  const notes: PhoneNote[] = [];
  let digits: string;
  if (includesDial(compact, dial)) {
    digits = compact;
    notes.push({ code: "dial_already_included", dial });
  } else if (dial === "7") {
    // Russia and Kazakhstan dial a national 8 instead of 0.
    digits = dial + (compact.length === 11 && compact.startsWith("8") ? compact.slice(1) : compact);
  } else if (dial === "39") {
    // Italian landlines keep their leading 0 in international format.
    digits = dial + compact;
  } else {
    digits = dial + compact.replace(/^0/, "");
  }

  if (dial === "54" && !digits.startsWith("549")) {
    notes.push({ code: "argentina_mobile" });
  }
  return international(digits, notes);
};

/** The click-to-chat link with no length cap; null when there's neither a number nor a message. */
export const formatWhatsAppLink = (digits: string, message: string): string | null => {
  const text = message.replace(/\r\n?/g, "\n");
  const hasText = text.trim() !== "";
  if (!digits && !hasText) return null;
  return `https://wa.me/${digits}${hasText ? `?text=${encodeURIComponent(text)}` : ""}`;
};

/** The click-to-chat link, or null when there's nothing to link to or it's too long to share. */
export const buildWhatsAppLink = (digits: string, message: string): string | null => {
  const link = formatWhatsAppLink(digits, message);
  return link && link.length <= MAX_URL_LENGTH ? link : null;
};

/**
 * Where "Shorten this link" goes: straight to the editor when signed in, else via sign-up with the
 * tool's own UTM params only. The link (it holds a phone number) rides in the shorten-intent
 * cookie set on click, so it never sits in an href that analytics records.
 */
export const getShortenHref = (
  output: string | null,
  signedIn: boolean | null,
  campaign = DEFAULT_CAMPAIGN,
): string => {
  if (signedIn) {
    return output ? `/dashboard/link/new?url=${encodeURIComponent(output)}` : "/dashboard/link/new";
  }
  return `${Paths.Signup}?${toolUtm(campaign)}`;
};
