// Platform-provided short-link domains. First entry is the default for new
// links and the preferred host for short-link previews. All
// entries must be wired at the infrastructure layer (DNS + SSL + host) and
// resolve to this Next.js app. Self-hosted instances set
// NEXT_PUBLIC_PLATFORM_DOMAINS (comma-separated, default first); NEXT_PUBLIC_*
// values are inlined at build time, so client and server always agree.
export const PLATFORM_DOMAINS: readonly string[] = parseDomainList(
  process.env.NEXT_PUBLIC_PLATFORM_DOMAINS,
) ?? ["isht.app", "isht.ink", "ishortn.ink"];

export const DEFAULT_PLATFORM_DOMAIN: string = PLATFORM_DOMAINS[0]!;

// Clerk is configured on the full app domain, so authenticated app/team
// navigation must stay on this host instead of the shorter link domain. Honor
// NEXT_PUBLIC_APP_DOMAIN so staging and self-hosted instances point email and
// absolute-URL flows at their own host.
export const APP_BASE_DOMAIN: string =
  process.env.NEXT_PUBLIC_APP_DOMAIN?.trim().toLowerCase() || "ishortn.ink";

// New teams default to the app domain when it also serves short links (the
// hosted service's teams have always started on it), else the default domain.
export const DEFAULT_TEAM_DOMAIN: string = PLATFORM_DOMAINS.includes(APP_BASE_DOMAIN)
  ? APP_BASE_DOMAIN
  : DEFAULT_PLATFORM_DOMAIN;

export function parseDomainList(value: string | undefined): string[] | undefined {
  const domains = (value ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
  return domains.length ? domains : undefined;
}

export function isPlatformDomain(domain: string | null | undefined): boolean {
  return !!domain && PLATFORM_DOMAINS.includes(domain);
}

// Base host for authenticated app URLs (team invites, workspace switching,
// accept-invite redirects). Keep this separate from DEFAULT_PLATFORM_DOMAIN so
// Clerk-authenticated pages stay on the domain configured in Clerk.
export function getAppBaseDomain(): string {
  return APP_BASE_DOMAIN;
}

// Returns the leading label when `host` is a team subdomain of a platform
// domain (e.g. "acme.isht.app" -> "acme"). Every platform domain needs wildcard
// DNS and a `*.<domain>/*` worker route for this. Returns null for bare platform
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

// Absolute URL into the authenticated app. Team workspaces are resolved from
// the `<slug>.` subdomain, so links into team resources must carry the slug or
// they open the personal workspace.
export function getAppUrl(path: string, teamSlug?: string | null): string {
  const host = teamSlug ? `${teamSlug}.${getAppBaseDomain()}` : getAppBaseDomain();
  return `https://${host}${path}`;
}

// The app's own host, where app-only public pages (docs, shared stats) are served: the app
// domain, plus localhost and workers.dev previews. Never a short-link or custom domain.
export function isAppHost(host: string): boolean {
  const hostname = (host.split(":")[0] ?? host).replace(/\.$/, "").toLowerCase();
  return (
    hostname === APP_BASE_DOMAIN ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".workers.dev")
  );
}
