import { z } from "zod";

// Domains added before the move to Cloudflare for SaaS (deployed 2026-08-14)
// lived on the old network and had to re-point their DNS. Anything added later
// was created on Cloudflare directly and goes through normal verification, so
// only older domains can need the migration notice.
export const DOMAIN_MIGRATION_CUTOFF = new Date("2026-08-15T00:00:00Z");

// Shown to the owner of a domain an admin rejected after review
export const DOMAIN_REJECTED_MESSAGE =
  "This domain can't be connected to iShortn. Contact support if you think this is a mistake.";

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

// Domains added by accounts younger than NEW_ACCOUNT_REVIEW_DAYS are held for
// admin review when their registrable domain is younger than NEW_DOMAIN_REVIEW_DAYS:
// fresh accounts connecting lookalike domains registered weeks earlier is the
// pattern behind the phishing accounts.
export const NEW_ACCOUNT_REVIEW_DAYS = 14;
export const NEW_DOMAIN_REVIEW_DAYS = 120;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isWithinDays(date: Date, days: number, now: Date): boolean {
  return now.getTime() - date.getTime() < days * DAY_MS;
}

export type DomainRegistration = { registeredAt: Date; registrar: string | null };

// The registrar's display name is the "fn" property of its jCard (RFC 7095)
const jCardNameSchema = z
  .tuple([z.literal("vcard"), z.array(z.array(z.unknown()))])
  .transform(([, properties]) => properties.find((property) => property[0] === "fn")?.[3])
  .pipe(
    z
      .string()
      .trim()
      .min(1)
      .transform((name) => name.slice(0, 255)), // fits CustomDomain.registrar
  )
  .optional()
  .catch(undefined);

/**
 * The parts of an RDAP domain response (RFC 9083) the review uses. Malformed
 * pieces fall back to empty rather than failing the whole response.
 */
export const rdapDomainSchema = z.object({
  events: z.array(z.object({ eventAction: z.string(), eventDate: z.string() })).catch([]),
  entities: z
    .array(z.object({ roles: z.array(z.string()).catch([]), vcardArray: jCardNameSchema }))
    .catch([]),
});

export type RdapDomain = z.infer<typeof rdapDomainSchema>;

/** The registration date and registrar name, or null without a usable registration event. */
export function registrationFromRdap(rdap: RdapDomain): DomainRegistration | null {
  const event = rdap.events.find((e) => e.eventAction === "registration");
  const registeredAt = event ? new Date(event.eventDate) : null;
  if (!registeredAt || Number.isNaN(registeredAt.getTime())) return null;

  const registrar = rdap.entities.find((e) => e.roles.includes("registrar"))?.vcardArray ?? null;
  return { registeredAt, registrar };
}
