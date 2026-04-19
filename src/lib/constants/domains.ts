// Platform-provided short-link domains. First entry is the default for new
// links and the preferred host for marketing/team subdomain previews. All
// entries must be wired at the infrastructure layer (DNS + SSL + host) and
// resolve to this Next.js app.
export const PLATFORM_DOMAINS = ["isht.ink", "ishortn.ink"] as const;

export type PlatformDomain = (typeof PLATFORM_DOMAINS)[number];

export const DEFAULT_PLATFORM_DOMAIN: PlatformDomain = PLATFORM_DOMAINS[0];

export function isPlatformDomain(domain: string | null | undefined): domain is PlatformDomain {
  return !!domain && (PLATFORM_DOMAINS as readonly string[]).includes(domain);
}

// Base host for user-facing app URLs (team invites, workspace switching,
// accept-invite redirects). Respects NEXT_PUBLIC_APP_DOMAIN override.
export function getAppBaseDomain(): string {
  return process.env.NEXT_PUBLIC_APP_DOMAIN || DEFAULT_PLATFORM_DOMAIN;
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
