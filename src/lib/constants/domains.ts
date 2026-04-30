// Platform-provided short-link domains. First entry is the default for new
// links and the preferred host for short-link previews. All
// entries must be wired at the infrastructure layer (DNS + SSL + host) and
// resolve to this Next.js app.
export const PLATFORM_DOMAINS = ["isht.ink", "ishortn.ink"] as const;

export type PlatformDomain = (typeof PLATFORM_DOMAINS)[number];

export const DEFAULT_PLATFORM_DOMAIN: PlatformDomain = PLATFORM_DOMAINS[0];

// Clerk is configured on the full iShortn domain, so authenticated app/team
// navigation must stay on this host instead of the shorter link domain.
export const APP_BASE_DOMAIN = "ishortn.ink";

export function isPlatformDomain(domain: string | null | undefined): domain is PlatformDomain {
  return !!domain && (PLATFORM_DOMAINS as readonly string[]).includes(domain);
}

// Base host for authenticated app URLs (team invites, workspace switching,
// accept-invite redirects). Keep this separate from DEFAULT_PLATFORM_DOMAIN so
// Clerk-authenticated pages stay on the domain configured in Clerk. Honor
// NEXT_PUBLIC_APP_DOMAIN so staging/dev can point email and absolute-URL flows
// at a non-prod host instead of baking ishortn.ink into outbound links.
export function getAppBaseDomain(): string {
  const configured = process.env.NEXT_PUBLIC_APP_DOMAIN?.trim();
  return configured || APP_BASE_DOMAIN;
}

// Returns the leading label when `host` is a team subdomain of a platform
// domain (e.g. "acme.isht.ink" -> "acme"). Returns null for bare platform
// hosts and anything outside the catalogue. Host matching is case-insensitive
// to match DNS semantics, and a trailing dot (FQDN form) is tolerated.
export function extractPlatformSubdomain(host: string): string | null {
  const normalized = host.trim().replace(/\.$/, "").toLowerCase();
  for (const platformDomain of PLATFORM_DOMAINS) {
    if (!normalized.endsWith(`.${platformDomain}`)) continue;
    const parts = normalized.split(".");
    if (parts.length !== platformDomain.split(".").length + 1) continue;
    const candidate = parts[0];
    if (candidate) return candidate;
  }
  return null;
}
