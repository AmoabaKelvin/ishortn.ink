import { credentialFormHost } from "../index";
import { isSharedHostTenant } from "../shared-hosts";
import { isWellKnownHost } from "../well-known-hosts";
import { RESCAN_REASON_PREFIX } from "./utils";

import type { RescanDecision } from "./utils";
import type { PageSignals } from "@/server/lib/metadata";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * When a selected link's page is fetched again, by link age. Kits are often switched on minutes
 * after the link is made, or after a challenge page has seen off the creation check.
 */
export const CONTENT_CHECK_DELAYS_MS = [30 * MINUTE_MS, 24 * HOUR_MS] as const;
/** Links older than this are no longer re-checked, whatever checks they missed. */
export const CONTENT_WINDOW_MS = 48 * HOUR_MS;
/** Free accounts younger than this have their new links re-checked. */
export const NEW_ACCOUNT_MS = 14 * DAY_MS;

export const CONTENT_REASON = `${RESCAN_REASON_PREFIX}content`;

/** A link that could be selected for content re-checks. */
export type ContentLink = {
  url: string | null;
  createdAt: Date | null;
  blocked: boolean | null;
  teamId: number | null;
  /** The owner's sign-up date; null when unknown. */
  ownerCreatedAt: Date | null;
  /** The owner has an entitled subscription. */
  paying: boolean;
  /** The creation check recorded the link as unverified or its fetch as failed (LinkSafetyRecheck). */
  unverifiedAtCreation: boolean;
};

const isHttpUrl = (url: string) => /^https?:\/\//i.test(url);

/**
 * New links (48 h) that aren't blocked, point at a host that isn't on the well-known list, and
 * either belong to a free personal account younger than 14 days or were left unverified by the
 * creation check, whatever the account.
 */
export function selectsForContentCheck(link: ContentLink, now: Date): boolean {
  if (link.blocked || !link.url || !isHttpUrl(link.url) || isWellKnownHost(link.url)) return false;
  if (!link.createdAt || now.getTime() - link.createdAt.getTime() > CONTENT_WINDOW_MS) return false;
  if (link.unverifiedAtCreation) return true;
  if (link.teamId !== null || link.paying || !link.ownerCreatedAt) return false;
  return now.getTime() - link.ownerCreatedAt.getTime() < NEW_ACCOUNT_MS;
}

/** How many of the scheduled checks a link of this age should have had. */
export function checksDueBy(linkCreatedAt: Date, now: Date): number {
  const age = now.getTime() - linkCreatedAt.getTime();
  return CONTENT_CHECK_DELAYS_MS.filter((delay) => age >= delay).length;
}

/**
 * A check is due when the link has reached a check time it hasn't had yet. A link whose first
 * check was missed gets a single check that counts for both (see `checksDueBy`).
 */
export function isContentCheckDue(linkCreatedAt: Date, checksDone: number, now: Date): boolean {
  if (now.getTime() - linkCreatedAt.getTime() > CONTENT_WINDOW_MS) return false;
  return checksDueBy(linkCreatedAt, now) > checksDone;
}

// Public sites of banks, payment, email and telecom providers: what a cloaked kit on a free host
// shows crawlers and other unwanted visitors. Matched on a dot boundary. Identity providers'
// sign-in hosts (login.microsoftonline.com, accounts.google.com) are left out on purpose: that is
// where SharePoint, Azure App Service and Firebase send anonymous visitors.
const IMPERSONATED_SITE_SUFFIXES = [
  // Email
  "aol.com",
  "gmail.com",
  "gmx.com",
  "gmx.net",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "microsoft365.com",
  "office.com",
  "outlook.com",
  "proton.me",
  "protonmail.com",
  "web.de",
  "yahoo.com",
  "zoho.com",
  // Payment
  "americanexpress.com",
  "binance.com",
  "cash.app",
  "coinbase.com",
  "klarna.com",
  "mastercard.com",
  "paypal.com",
  "revolut.com",
  "stripe.com",
  "venmo.com",
  "visa.com",
  "wise.com",
  "zellepay.com",
  // Banks (plus any "bankof..." name, see `impersonatedSite`)
  "barclays.co.uk",
  "barclays.com",
  "bbva.com",
  "capitalone.com",
  "chase.com",
  "citi.com",
  "commbank.com.au",
  "hsbc.co.uk",
  "hsbc.com",
  "ing.com",
  "lloydsbank.com",
  "nationwide.co.uk",
  "natwest.com",
  "pnc.com",
  "santander.co.uk",
  "santander.com",
  "usbank.com",
  "wellsfargo.com",
  // Telecom
  "att.com",
  "bt.com",
  "comcast.net",
  "o2.co.uk",
  "orange.fr",
  "t-mobile.com",
  "telstra.com.au",
  "verizon.com",
  "vodafone.co.uk",
  "vodafone.com",
  "xfinity.com",
];
// Sign-in hosts: a redirect there is how sign-in-gated apps and shares greet anonymous visitors.
const AUTH_HOST_LABELS = new Set(["accounts", "auth", "id", "login", "oauth", "signin", "sso"]);

function impersonatedSite(host: string): boolean {
  const labels = host.split(".");
  if (AUTH_HOST_LABELS.has(labels[0] ?? "")) return false;
  if (IMPERSONATED_SITE_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`))) return true;
  // bankofamerica.com, bankofireland.com. A bare "bank" substring also matches foodbank.org and
  // bankrate.com, so only this prefix counts.
  return labels.slice(0, -1).some((label) => label.startsWith("bankof"));
}

// A home page, possibly localised ("/", "/en", "/en-gb/", "/us/en/index.html"). Deeper paths are
// sign-in, checkout or content pages that legitimate sites send visitors to.
const HOME_PAGE_SEGMENT = /^([a-z]{2}([-_][a-z]{2})?|home|index\.html?)$/i;

function isHomePage(url: URL): boolean {
  const segments = url.pathname.split("/").filter(Boolean);
  return segments.length <= 2 && segments.every((segment) => HOME_PAGE_SEGMENT.test(segment));
}

function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

const hostnameOf = (url: URL) => url.hostname.toLowerCase().replace(/^www\./, "");

/**
 * A page on a free-hosting subdomain that redirects to the home page of a bank, payment, email or
 * telecom provider's real site: a kit showing its target's own site to visitors it doesn't want (a
 * crawler, the wrong country). Returns the site it ended on, or null.
 */
export function cloakingRedirect(startUrl: string, finalUrl: string): string | null {
  const startParsed = parseUrl(startUrl);
  const endParsed = parseUrl(finalUrl);
  if (!startParsed || !endParsed || !isHomePage(endParsed)) return null;
  const start = hostnameOf(startParsed);
  const end = hostnameOf(endParsed);
  if (start === end || !isSharedHostTenant(start)) return null;
  if (isSharedHostTenant(end) || !impersonatedSite(end)) return null;
  return end;
}

export type ContentCheck =
  | { kind: "error"; error: string }
  /** A bot challenge or an error page: nothing about the real page is known yet. */
  | { kind: "unverified" }
  | { kind: "clean" }
  | { kind: "phishing"; details: string };

/** What a fetched page says, before the LLM; null means it's up to the LLM. */
export function pageSignalCheck(url: string, signals: PageSignals): ContentCheck | null {
  const cloakedTo = cloakingRedirect(url, signals.finalUrl);
  if (cloakedTo) {
    return {
      kind: "phishing",
      details: `Free-hosting page redirects to ${cloakedTo}: ${url} -> ${signals.finalUrl}`,
    };
  }
  if (signals.isChallenge || signals.status < 200 || signals.status >= 300) {
    return { kind: "unverified" };
  }
  const formHost = credentialFormHost(signals);
  if (formHost) {
    return { kind: "phishing", details: `Password form on shared host ${formHost}: ${url}` };
  }
  return null;
}

/** A block in the re-scan's terms; `flagPayingAccounts` and `capBlocks` decide the rest. */
export function contentDecision(linkId: number, check: ContentCheck): RescanDecision | null {
  if (check.kind !== "phishing") return null;
  return {
    linkId,
    action: "block",
    source: "content",
    reason: CONTENT_REASON,
    details: `Destination content: ${check.details}`,
  };
}
