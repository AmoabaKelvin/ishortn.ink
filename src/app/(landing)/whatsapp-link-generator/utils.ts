import { Paths } from "@/lib/constants/app";

import { MAX_URL_LENGTH } from "../_lib/parse-url";

const TOOL_UTM = "utm_source=ishortn&utm_medium=tool&utm_campaign=whatsapp-link";

export const FEATURES_SIGNUP_HREF = `${Paths.Signup}?${TOOL_UTM}&utm_content=features`;

// E.164 allows at most 15 digits; nothing real is shorter than 8 with its country code.
const MIN_DIGITS = 8;
const MAX_DIGITS = 15;

export type PhoneResult =
  | { ok: true; digits: string; display: string; notes: string[] }
  | { ok: false; error: string };

const international = (digits: string, notes: string[] = []): PhoneResult => {
  if (digits.length < MIN_DIGITS) {
    return { ok: false, error: "That number looks too short. Check the country code and number." };
  }
  if (digits.length > MAX_DIGITS) {
    return {
      ok: false,
      error: "That number is too long. International numbers have at most 15 digits.",
    };
  }
  return { ok: true, digits, display: `+${digits}`, notes };
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
    return { ok: false, error: "Use digits only, like +44 7700 900123." };
  }
  if (compact.startsWith("+")) return international(compact.slice(1));
  if (compact.startsWith("00")) return international(compact.slice(2));
  if (!dial) return { ok: false, error: "Choose a country or start the number with +." };

  const notes: string[] = [];
  let digits: string;
  if (compact.startsWith(dial) && compact.length >= 11) {
    digits = compact;
    notes.push(`This number already starts with +${dial}, so we didn't add it again.`);
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
    notes.push("WhatsApp numbers for Argentine mobiles usually start with +54 9.");
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
export const getShortenHref = (output: string | null, signedIn: boolean | null): string => {
  if (signedIn) {
    return output ? `/dashboard/link/new?url=${encodeURIComponent(output)}` : "/dashboard/link/new";
  }
  return `${Paths.Signup}?${TOOL_UTM}`;
};
