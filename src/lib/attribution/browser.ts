import { FIRST_TOUCH_COOKIE, FIRST_TOUCH_MAX_AGE_SECONDS } from "./first-touch";

// Browser-only helpers for the `ish_ft` cookie; call from effects, never during render.

export function readFirstTouchCookie(): string | null {
  const prefix = `${FIRST_TOUCH_COOKIE}=`;
  for (const part of document.cookie.split(";")) {
    const entry = part.trim();
    if (entry.startsWith(prefix)) return entry.slice(prefix.length) || null;
  }
  return null;
}

function cookieAttributes(maxAge: number): string {
  // Secure only over HTTPS so local http development still gets the cookie.
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  return `; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function writeFirstTouchCookie(value: string): void {
  document.cookie = `${FIRST_TOUCH_COOKIE}=${value}${cookieAttributes(FIRST_TOUCH_MAX_AGE_SECONDS)}`;
}

export function clearFirstTouchCookie(): void {
  document.cookie = `${FIRST_TOUCH_COOKIE}=${cookieAttributes(0)}`;
}
