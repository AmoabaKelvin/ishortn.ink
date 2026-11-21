// Domains added before the move to Cloudflare for SaaS (deployed 2026-08-14)
// lived on the old network and had to re-point their DNS. Anything added later
// was created on Cloudflare directly and goes through normal verification, so
// only older domains can need the migration notice.
export const DOMAIN_MIGRATION_CUTOFF = new Date("2026-08-15T00:00:00Z");

// Lowercase labels of 1-63 letters, digits or inner hyphens, at least two of
// them, ending in an alphabetic or punycode TLD. Ports, paths, spaces and
// underscores don't match.
export const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

/**
 * Turns what people paste into the domain field ("HTTPS://Links.Example.com/ ")
 * into a bare lowercase hostname. Only the scheme, trailing slashes and a
 * trailing dot are dropped; paths and ports are left in place so validation
 * rejects them, and a leading "www." is kept because it is a different host.
 */
export function normalizeDomainInput(raw: string): string {
  const value = raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/\/+$/, "")
    .replace(/\.$/, "");

  if (/[\s/:?#@]/.test(value)) return value;

  // URL parsing converts internationalised names to punycode (bücher.de → xn--bcher-kva.de)
  try {
    return new URL(`http://${value}`).hostname;
  } catch {
    return value;
  }
}
