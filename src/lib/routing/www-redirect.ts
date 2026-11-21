import { APP_BASE_DOMAIN } from "@/lib/constants/domains";

const WWW_APP_HOST = `www.${APP_BASE_DOMAIN}`;

// Canonical-host redirect for the app domain, run in the worker entry ahead of
// Next.js so www never serves a duplicate copy of the site. Only the app domain
// is covered: short-link and custom domains handle www in link resolution.
// API routes are exempt: webhook senders (Svix, Resend, Lemon Squeezy) don't
// follow redirects, so a 301 would drop their POSTs.
export function getWwwRedirectUrl(requestUrl: string): string | null {
  const url = new URL(requestUrl);
  if (url.hostname.toLowerCase().replace(/\.$/, "") !== WWW_APP_HOST) return null;
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return null;
  return `https://${APP_BASE_DOMAIN}${url.pathname}${url.search}`;
}
