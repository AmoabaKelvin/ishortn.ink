import { differenceInDays } from "date-fns";
import { getDomain } from "tldts";

import { logger } from "@/lib/logger";

import {
  isWithinDays,
  NEW_ACCOUNT_REVIEW_DAYS,
  NEW_DOMAIN_REVIEW_DAYS,
  rdapDomainSchema,
  registrationFromRdap,
} from "./utils";

import type { DomainRegistration } from "./utils";

const log = logger.child({ component: "domains.rdap" });

const RDAP_TIMEOUT_MS = 5_000;

type RdapFetch = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Registration date and registrar of a registrable domain from RDAP, or null
 * when the lookup fails, times out or the registry doesn't publish a date.
 * rdap.org redirects to the registry's own RDAP server.
 */
export async function lookupDomainRegistration(
  registrableDomain: string,
  fetchImpl: RdapFetch = fetch,
): Promise<DomainRegistration | null> {
  try {
    const response = await fetchImpl(
      `https://rdap.org/domain/${encodeURIComponent(registrableDomain)}`,
      {
        headers: { accept: "application/rdap+json, application/json" },
        signal: AbortSignal.timeout(RDAP_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      log.warn({ domain: registrableDomain, status: response.status }, "RDAP lookup failed");
      return null;
    }
    const parsed = rdapDomainSchema.safeParse(await response.json());
    const registration = parsed.success ? registrationFromRdap(parsed.data) : null;
    if (!registration) {
      log.warn({ domain: registrableDomain }, "RDAP response has no registration date");
    }
    return registration;
  } catch (error) {
    log.warn({ err: error, domain: registrableDomain }, "RDAP lookup failed");
    return null;
  }
}

export type DomainReviewFields = {
  reviewStatus: "held" | null;
  reviewReason: string | null;
  registrableDomainRegisteredAt: Date | null;
  registrar: string | null;
  rdapLookupFailed: boolean;
};

const days = (count: number) => `${count} ${count === 1 ? "day" : "days"}`;

const NOT_REVIEWED: DomainReviewFields = {
  reviewStatus: null,
  reviewReason: null,
  registrableDomainRegisteredAt: null,
  registrar: null,
  rdapLookupFailed: false,
};

/**
 * Decides whether a domain being added goes to admin review. Only accounts
 * that are still new pay for the RDAP round trip; for them, a recently
 * registered registrable domain is held. A failed lookup never holds.
 */
export async function reviewNewDomain(
  domain: string,
  accountCreatedAt: Date | null,
  {
    lookupRegistration = lookupDomainRegistration,
    now = new Date(),
  }: { lookupRegistration?: typeof lookupDomainRegistration; now?: Date } = {},
): Promise<DomainReviewFields> {
  const registrableDomain = getDomain(domain);
  if (!accountCreatedAt || !registrableDomain) return NOT_REVIEWED;

  if (!isWithinDays(accountCreatedAt, NEW_ACCOUNT_REVIEW_DAYS, now)) return NOT_REVIEWED;

  const registration = await lookupRegistration(registrableDomain);
  if (!registration) return { ...NOT_REVIEWED, rdapLookupFailed: true };

  const held = isWithinDays(registration.registeredAt, NEW_DOMAIN_REVIEW_DAYS, now);

  return {
    reviewStatus: held ? "held" : null,
    reviewReason: held
      ? `Account ${days(differenceInDays(now, accountCreatedAt))} old; domain registered ${days(differenceInDays(now, registration.registeredAt))} ago`
      : null,
    registrableDomainRegisteredAt: registration.registeredAt,
    registrar: registration.registrar,
    rdapLookupFailed: false,
  };
}
