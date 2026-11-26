// Internal to src/lib/attribution, shared by first-touch.ts and parse-first-touch.ts. Other code
// imports those modules.

export const FIRST_TOUCH_VALUE_MAX_LENGTH = 255;

/** Trims a tracked value and caps its length; empty values become null. */
export function clean(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim().slice(0, FIRST_TOUCH_VALUE_MAX_LENGTH);
  return trimmed === "" ? null : trimmed;
}
