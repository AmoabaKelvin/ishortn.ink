import { findEmailInRedirect } from "../heuristics";
import { SHARED_HOST_SUFFIXES } from "../shared-hosts";

const RESCAN_SOURCES = [
  "phishing-database-links",
  "phishing-database-domains",
  "openphish",
  "urlhaus",
  "safe-browsing",
  "campaign-pattern",
  "content",
] as const;

export type RescanSource = (typeof RESCAN_SOURCES)[number];

export type FeedKind = "url" | "domain";

export type ScanLink = { id: number; url: string | null; domain: string; alias: string | null };

export type MatchKind =
  | "url"
  | "short-link"
  | "domain"
  | "threat"
  | "campaign-path"
  | "email-redirect";

export type RescanMatch = {
  linkId: number;
  source: RescanSource;
  kind: MatchKind;
  /** Feed entry, threat types or campaign evidence that matched, kept for the review details. */
  entry: string;
  host: string;
};

export type RescanDecision = {
  linkId: number;
  action: "block" | "flag";
  source: RescanSource;
  reason: string;
  details: string;
  /** Host to add to BlockedDomain alongside the block. */
  blockDomain?: string;
  /** Pending rescan flags on the link that this decision acts on instead of adding a new row. */
  resolvesFlagIds?: number[];
  /** The link already waits in the backlog: one of its pending flags is an over-the-cap block. */
  queued?: boolean;
  /** Rewrite the pending flags in `resolvesFlagIds` with this decision's reason and details. */
  relabel?: boolean;
};

/** A pending over-the-cap rescan flag, i.e. a confirmed block that is still waiting. */
export type BacklogFlag = {
  id: number;
  linkId: number;
  reason: string | null;
  details: string | null;
};

export type ExistingFlag = {
  id: number;
  linkId: number;
  status: "pending" | "blocked" | "dismissed";
  reason: string | null;
  details: string | null;
};

export const RESCAN_REASON_PREFIX = "phishing-rescan:";

const DOMAIN_BLOCK_DETAILS = "Destination host listed in feed: ";
export const PAYING_NOTE = " (paying account, review before blocking)";

// Large sites that the feeds list as whole domains or bare home pages (docs.google.com,
// sites.google.com, notion.so, gravatar.com, ...). Such listings never act on a link.
const MAJOR_SITE_SUFFIXES = [
  "1drv.ms",
  "adobe.com",
  "apple.com",
  "cloudflare.com",
  "discord.com",
  "discord.gg",
  "facebook.com",
  "forms.gle",
  "github.com",
  "gitlab.com",
  "goo.gl",
  "gravatar.com",
  "icloud.com",
  "instagram.com",
  "linkedin.com",
  "live.com",
  "microsoft.com",
  "microsoft365.com",
  "microsoftonline.com",
  "notion.so",
  "office.com",
  "outlook.com",
  "t.me",
  "telegram.org",
  "tiktok.com",
  "twitter.com",
  "wa.me",
  "walletconnect.com",
  "whatsapp.com",
  "wix.com",
  "x.com",
  "youtube.com",
  "zoom.us",
];

// Brands that run one site per country (google.com.bo, amazon.ie, mercadolibre.cl, blogspot.fi).
const BRAND_CCTLD_PATTERN =
  /(^|\.)(amazon|apple|blogspot|ebay|google|mercadolibre|mercadolivre|microsoft|paypal|yahoo)\.(com?\.)?[a-z]{2,3}$/;

function matchesSuffix(host: string, suffixes: readonly string[]): boolean {
  return suffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

/** A host whose owner the feeds can't speak for: the platform itself or any of its tenants. */
export function isSharedHost(host: string, ownHosts: ReadonlySet<string>): boolean {
  return matchesSuffix(host, SHARED_HOST_SUFFIXES) || isProtectedHost(host, ownHosts);
}

/** A platform apex or major site, where even a listed home page is too broad to auto-block. */
export function isProtectedHost(host: string, ownHosts: ReadonlySet<string>): boolean {
  return (
    ownHosts.has(host) ||
    SHARED_HOST_SUFFIXES.includes(host) ||
    matchesSuffix(host, MAJOR_SITE_SUFFIXES) ||
    BRAND_CCTLD_PATTERN.test(host)
  );
}

/** Lowercases and strips `www.`, a trailing dot and any port; null when it isn't a plain hostname. */
export function normalizeHost(raw: string): string | null {
  let host = raw.trim().toLowerCase();
  const colon = host.indexOf(":");
  if (colon !== -1) host = host.slice(0, colon);
  if (host.endsWith(".")) host = host.slice(0, -1);
  if (host.startsWith("www.")) host = host.slice(4);
  if (!host.includes(".") || !/^[a-z0-9.-]+$/.test(host)) return null;
  return host;
}

/**
 * Host of a URL by string slicing. Feeds have ~800k lines and only entries on a host we link to
 * are worth a full `new URL()` parse; a host this gets wrong simply doesn't match.
 */
export function hostOfUrl(raw: string): string | null {
  let rest = raw.trim();
  const scheme = rest.indexOf("://");
  if (scheme !== -1) rest = rest.slice(scheme + 3);
  let end = rest.length;
  for (const delimiter of ["/", "?", "#", "\\"]) {
    const index = rest.indexOf(delimiter);
    if (index !== -1 && index < end) end = index;
  }
  const authority = rest.slice(0, end);
  return normalizeHost(authority.slice(authority.lastIndexOf("@") + 1));
}

/**
 * Comparison key for a URL: host (normalised, plus a non-default port), path without trailing
 * slashes, and query. Scheme and fragment are ignored, so `https://a.com/` and `http://www.a.com`
 * share the key `a.com`.
 */
export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Feeds list some entries without a scheme; `mailto:` and the like still parse as their own.
  const hasScheme = trimmed.includes("://") || /^[a-z]+:/i.test(trimmed);
  let parsed: URL;
  try {
    parsed = new URL(hasScheme ? trimmed : `http://${trimmed}`);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const host = normalizeHost(parsed.hostname);
  if (!host) return null;
  const port = parsed.port ? `:${parsed.port}` : "";
  return `${host}${port}${parsed.pathname.replace(/\/+$/, "")}${parsed.search}`;
}

/** True for a key with no path or query, i.e. the site's home page. */
function isHomePageKey(key: string): boolean {
  return !key.includes("/") && !key.includes("?");
}

/** One entry per line; blank lines and `#`/`!` comments are skipped. */
export function parsePlainFeedLine(line: string): string | null {
  const entry = line.trim();
  if (!entry || entry.startsWith("#") || entry.startsWith("!")) return null;
  return entry;
}

/** URLhaus CSV export: `id,dateadded,url,url_status,...`; only rows still online count. */
export function parseUrlhausCsvLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const fields = parseCsvLine(trimmed);
  const url = fields[2];
  return url && fields[3] === "online" ? url : null;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

/** Link ids under one key; a bare number for the common single-link case keeps the index small. */
type IdList = number | number[];

export type ListedShortLink = { source: RescanSource; entry: string; host: string; alias: string };

export type LinkIndex = {
  byUrl: Map<string, IdList>;
  byHost: Map<string, IdList>;
  /** Our short-link domains: never blocklisted, and feed URLs on them are matched to aliases. */
  ownHosts: Set<string>;
  /**
   * Feed URLs that point at one of our short links, keyed by `host/alias` (alias lowercased, as
   * aliases resolve case-insensitively). Few in number, so they're resolved to links with one
   * query after the scan instead of indexing every alias up front.
   */
  listedShortLinks: Map<string, ListedShortLink[]>;
};

export function createLinkIndex(platformDomains: readonly string[]): LinkIndex {
  return {
    byUrl: new Map(),
    byHost: new Map(),
    ownHosts: new Set(platformDomains),
    listedShortLinks: new Map(),
  };
}

function idsOf(ids: IdList | undefined): number[] {
  if (ids === undefined) return [];
  return Array.isArray(ids) ? ids : [ids];
}

/** Adds `id` under `key` unless it was the last id added there. */
function pushId(map: Map<string, IdList>, key: string, id: number) {
  const ids = map.get(key);
  if (ids === undefined) map.set(key, id);
  else if (Array.isArray(ids)) {
    if (ids.at(-1) !== id) ids.push(id);
  } else if (ids !== id) map.set(key, [ids, id]);
}

function push<K>(map: Map<K, number[]>, key: K, id: number) {
  const ids = map.get(key);
  if (ids) ids.push(id);
  else map.set(key, [id]);
}

const shortLinkKey = (host: string, alias: string) => `${host}/${alias.toLowerCase()}`;

export function addLinkToIndex(index: LinkIndex, link: ScanLink): void {
  const ownHost = normalizeHost(link.domain);
  if (ownHost) index.ownHosts.add(ownHost);
  if (link.url) addDestinationToIndex(index, link.id, link.url);
}

/**
 * Indexes a redirect target of a link: its URL, or a geo rule's destination. Links are added in id
 * order, so a link repeating its URL in a geo rule is recorded once.
 */
export function addDestinationToIndex(index: LinkIndex, linkId: number, url: string): void {
  const key = normalizeUrl(url);
  if (!key) return;
  pushId(index.byUrl, key, linkId);
  const host = hostOfUrl(key);
  if (host) pushId(index.byHost, host, linkId);
}

export function matchFeedEntry(
  index: LinkIndex,
  source: RescanSource,
  kind: FeedKind,
  entry: string,
): RescanMatch[] {
  if (kind === "domain") {
    const host = normalizeHost(entry);
    if (!host) return [];
    return idsOf(index.byHost.get(host)).map((linkId) => ({
      linkId,
      source,
      kind: "domain",
      entry,
      host,
    }));
  }

  const host = hostOfUrl(entry);
  if (!host || (!index.byHost.has(host) && !index.ownHosts.has(host))) return [];
  const key = normalizeUrl(entry);
  if (!key) return [];

  // The feed lists one of our short links itself (e.g. ishortn.ink/qsoi5tx8i).
  if (index.ownHosts.has(host) && key.startsWith(`${host}/`)) {
    const alias = key.slice(host.length + 1);
    if (alias && !alias.includes("/") && !alias.includes("?")) {
      const listed = index.listedShortLinks.get(shortLinkKey(host, alias)) ?? [];
      if (!listed.some((l) => l.source === source)) listed.push({ source, entry, host, alias });
      index.listedShortLinks.set(shortLinkKey(host, alias), listed);
    }
  }

  return idsOf(index.byUrl.get(key)).map((linkId) => ({
    linkId,
    source,
    kind: "url",
    entry,
    host,
  }));
}

/** Matches for the live short links among `rows` that a feed listed. */
export function shortLinkMatches(
  index: LinkIndex,
  rows: { id: number; domain: string; alias: string | null }[],
): RescanMatch[] {
  return rows.flatMap((row) => {
    const host = normalizeHost(row.domain);
    const listed =
      host && row.alias ? index.listedShortLinks.get(shortLinkKey(host, row.alias)) : [];
    return (listed ?? []).map((l) => ({
      linkId: row.id,
      source: l.source,
      kind: "short-link" as const,
      entry: l.entry,
      host: l.host,
    }));
  });
}

/**
 * Details of flags earlier versions raised with no evidence about the link itself: a domains feed
 * listing a shared host, or a links feed listing a major host's home page. Those matches are now
 * skipped, and pending flags with these details are dismissed by the rescan.
 */
export const LEGACY_FLAG_DETAILS = [
  "Destination host listed in feed, on a shared host: ",
  "Feed lists the home page of a shared or major host: ",
] as const;

/**
 * Null when the match says nothing about the link's own page: a host-level listing of a shared
 * host, or a listed home page of a major host. Links there are still blocked on URL-level
 * evidence (an exact URL listing, a Safe Browsing threat or a listed short link).
 */
export function decideMatch(
  match: RescanMatch,
  ownHosts: ReadonlySet<string>,
): RescanDecision | null {
  const reason = `${RESCAN_REASON_PREFIX} ${match.source}`;
  const base = { linkId: match.linkId, source: match.source, reason };

  switch (match.kind) {
    case "threat":
      return { ...base, action: "block", details: `Safe Browsing threat: ${match.entry}` };
    case "short-link":
      return { ...base, action: "block", details: `Short link listed in feed: ${match.entry}` };
    case "url": {
      const key = normalizeUrl(match.entry) ?? "";
      if (isHomePageKey(key) && isProtectedHost(match.host, ownHosts)) return null;
      return { ...base, action: "block", details: `Destination listed in feed: ${match.entry}` };
    }
    case "campaign-path":
      return {
        ...base,
        action: "block",
        details: `Same path as a link blocked for phishing: ${match.entry}`,
      };
    case "email-redirect":
      return {
        ...base,
        action: "block",
        details: `Email address in an open redirect: ${match.entry}`,
      };
    case "domain":
      if (isSharedHost(match.host, ownHosts)) return null;
      return {
        ...base,
        action: "block",
        details: `${DOMAIN_BLOCK_DETAILS}${match.entry}`,
        blockDomain: match.host,
      };
  }
}

// Paths every site of a platform shares, so equal paths say nothing about a shared campaign.
const COMMON_PATH_PREFIXES = [
  "wp-admin/",
  "wp-includes/",
  "wp-json/",
  "wp-login.php",
  ".well-known/",
  "cgi-bin/",
];
// Shorter common paths (`login`, `index.html`) are already under the length minimum.
const COMMON_PATHS = new Set([
  "common/oauth2/v2.0/authorize",
  "organizations/oauth2/v2.0/authorize",
  "customer/account/login/referer",
]);
// Long enough that two hosts serving it exactly means one kit, not a coincidence.
const MIN_DISTINCTIVE_PATH_LENGTH = 25;

/**
 * The URL's path without leading or trailing slashes, lowercased, when it is long and unusual
 * enough to identify a phishing kit deployed across many compromised hosts. Null otherwise.
 */
export function distinctivePath(url: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  const path = pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
  if (path.length < MIN_DISTINCTIVE_PATH_LENGTH || COMMON_PATHS.has(path)) return null;
  if (COMMON_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) return null;
  return path;
}

/** Distinctive paths (see `distinctivePath`) served by links blocked for phishing. */
export type BlockedPhishingPaths = ReadonlySet<string>;

/**
 * Indexes the destinations of links blocked for phishing by distinctive path. Destinations on a
 * shared or major host are left out: kits copy a brand's real paths and consent phishing runs on
 * the brand's own sign-in host, so such a path is no evidence against other links.
 */
export function indexBlockedPhishingPaths(
  urls: readonly string[],
  ownHosts: ReadonlySet<string>,
): Set<string> {
  const paths = new Set<string>();
  for (const url of urls) {
    const path = distinctivePath(url);
    const host = path ? hostOfUrl(url) : null;
    if (!path || !host || isSharedHost(host, ownHosts)) continue;
    paths.add(path);
  }
  return paths;
}

/**
 * Known campaign patterns in one destination of a link: a distinctive path that a link blocked
 * for phishing serves (the same URL re-shortened, or one kit deployed across compromised sites),
 * or an email address carried through an open redirector.
 */
export function campaignPatternMatches(
  linkId: number,
  url: string,
  blockedPaths: BlockedPhishingPaths,
  ownHosts: ReadonlySet<string>,
): RescanMatch[] {
  const matches: RescanMatch[] = [];
  const base = { linkId, source: "campaign-pattern" as const, entry: url, host: "" };
  const path = blockedPaths.size > 0 ? distinctivePath(url) : null;
  if (path && blockedPaths.has(path)) {
    const host = hostOfUrl(url);
    if (host && !isProtectedHost(host, ownHosts)) {
      matches.push({ ...base, kind: "campaign-path" });
    }
  }
  if (findEmailInRedirect(url)) matches.push({ ...base, kind: "email-redirect" });
  return matches;
}

/** One decision per link; a block outranks a flag, otherwise the first source wins. */
export function mergeDecisions(decisions: RescanDecision[]): RescanDecision[] {
  const byLink = new Map<number, RescanDecision>();
  for (const decision of decisions) {
    const current = byLink.get(decision.linkId);
    if (!current || (current.action === "flag" && decision.action === "block")) {
      byLink.set(decision.linkId, decision);
    }
  }
  return [...byLink.values()];
}

const CAP_NOTE = / \(over the \d+ auto-block limit for one run\)$/;
/** SQL `LIKE` pattern for the details of an over-the-cap flag; keep in sync with `capBlocks`. */
export const CAP_NOTE_LIKE = "% auto-block limit for one run)";
// Notes the rescan appends to a block it holds back; they don't change the evidence.
const HELD_NOTE =
  / \((over the \d+ auto-block limit for one run|paying account, review before blocking)\)$/;

// Feeds re-list the same URL with cosmetic differences (trailing slash, `www.`, scheme).
function evidenceKey(linkId: number, reason: string, details: string): string {
  const evidence = details
    .replace(HELD_NOTE, "")
    .replace(/\bhttps?:\/\/\S+/gi, (url) => normalizeUrl(url) ?? url);
  return `${linkId}\n${reason}\n${evidence}`;
}

/**
 * Drops decisions an admin has already ruled on. A rescan row that was dismissed, or blocked on a
 * link that is live again (an admin unblocked it), covers only the same source and the same
 * evidence: `details` names the matched feed entry or destination, so a new source, a stronger
 * match or a changed destination is still acted on. Reports from other places never suppress a
 * rescan decision. A pending rescan flag isn't raised twice, but a block resolves it.
 */
export function withoutResolvedLinks(
  decisions: RescanDecision[],
  existing: ExistingFlag[],
): RescanDecision[] {
  const ruled = new Set<string>();
  const pending = new Map<number, number[]>();
  const queued = new Set<number>();
  for (const flag of existing) {
    if (!flag.reason?.startsWith(RESCAN_REASON_PREFIX)) continue;
    if (flag.status === "pending") {
      push(pending, flag.linkId, flag.id);
      if (CAP_NOTE.test(flag.details ?? "")) queued.add(flag.linkId);
    } else ruled.add(evidenceKey(flag.linkId, flag.reason, flag.details ?? ""));
  }
  return decisions.flatMap((d) => {
    if (ruled.has(evidenceKey(d.linkId, d.reason, d.details))) return [];
    const pendingIds = pending.get(d.linkId);
    if (!pendingIds) return [d];
    if (d.action !== "block") return [];
    return [{ ...d, resolvesFlagIds: pendingIds, ...(queued.has(d.linkId) && { queued: true }) }];
  });
}

/**
 * Turns the backlog of over-the-cap flags back into the blocks they stood for, one per link, so
 * they are applied ahead of this run's new matches. The domain is re-derived from the details,
 * as `capBlocks` drops it.
 */
export function backlogDecisions(flags: BacklogFlag[]): RescanDecision[] {
  const byLink = new Map<number, RescanDecision>();
  for (const flag of flags) {
    const current = byLink.get(flag.linkId);
    if (current) {
      current.resolvesFlagIds?.push(flag.id);
      continue;
    }
    const reason = flag.reason ?? "";
    const raw = reason.slice(RESCAN_REASON_PREFIX.length).trim();
    const source = RESCAN_SOURCES.find((s) => s === raw);
    if (!reason.startsWith(RESCAN_REASON_PREFIX) || !source) continue;
    const details = (flag.details ?? "").replace(CAP_NOTE, "");
    const blockDomain = details.startsWith(DOMAIN_BLOCK_DETAILS)
      ? normalizeHost(details.slice(DOMAIN_BLOCK_DETAILS.length))
      : null;
    byLink.set(flag.linkId, {
      linkId: flag.linkId,
      action: "block",
      source,
      reason,
      details,
      ...(blockDomain && { blockDomain }),
      resolvesFlagIds: [flag.id],
      queued: true,
    });
  }
  return [...byLink.values()];
}

/**
 * Links owned by paying accounts are never blocked automatically: their blocks become flags for
 * an admin to review, and leave the backlog.
 */
export function flagPayingAccounts(
  decisions: RescanDecision[],
  payingLinkIds: ReadonlySet<number>,
): RescanDecision[] {
  return decisions.map((decision) => {
    if (decision.action !== "block" || !payingLinkIds.has(decision.linkId)) return decision;
    const { blockDomain: _, ...rest } = decision;
    return {
      ...rest,
      action: "flag",
      details: `${decision.details}${PAYING_NOTE}`,
      ...(decision.resolvesFlagIds && { relabel: true }),
    };
  });
}

/** Distinct links waiting in the backlog once `decisions` are applied, given `total` before. */
export function remainingBacklog(total: number, decisions: RescanDecision[]): number {
  let remaining = total;
  for (const d of decisions) {
    const waits = d.action === "flag" && CAP_NOTE.test(d.details);
    remaining += Number(waits) - Number(Boolean(d.queued));
  }
  return remaining;
}

/**
 * Caps automatic blocks per run so a bad feed update can't take down a large share of links.
 * Blocks over the cap are kept as pending flags, the backlog that later runs block first; a link
 * whose pending flag isn't yet in the backlog has it relabelled to join it.
 */
export function capBlocks(decisions: RescanDecision[], maxBlocks: number): RescanDecision[] {
  let blocks = 0;
  return decisions.map((decision) => {
    if (decision.action !== "block") return decision;
    blocks++;
    if (blocks <= maxBlocks) return decision;
    const { blockDomain: _, ...rest } = decision;
    return {
      ...rest,
      action: "flag",
      details: `${decision.details} (over the ${maxBlocks} auto-block limit for one run)`,
      ...(decision.resolvesFlagIds && !decision.queued && { relabel: true }),
    };
  });
}

type WindowPart = { urls: Map<string, number[]>; lastId: number; full: boolean };

/**
 * The Safe Browsing URLs for one run: up to `max` distinct URLs starting after the link id where
 * the previous run stopped, wrapping around, so links that went longest without a check go first.
 * Links are added in id order while paging, and only URLs that can still fall inside the window
 * are kept, so memory stays bounded by `max` rather than the link count.
 */
export type SafeBrowsingWindow = {
  cursor: number;
  max: number;
  /** Links after the cursor, checked first. */
  after: WindowPart;
  /** Links up to the cursor, used to fill the window after wrapping around. */
  before: WindowPart;
};

export type SafeBrowsingSelection = { urls: Map<string, number[]>; nextCursor: number };

export function createSafeBrowsingWindow(cursor: number, max: number): SafeBrowsingWindow {
  const part = (): WindowPart => ({ urls: new Map(), lastId: 0, full: false });
  return { cursor, max, after: part(), before: part() };
}

export function addSafeBrowsingCandidate(window: SafeBrowsingWindow, id: number, url: string) {
  const part = id > window.cursor ? window.after : window.before;
  const ids = part.urls.get(url);
  if (ids) {
    if (ids.at(-1) !== id) ids.push(id);
    return;
  }
  // A link's own URLs (main and geo rule destinations) are never split across runs.
  if (part.urls.size >= window.max && id !== part.lastId) {
    part.full = true;
    return;
  }
  part.urls.set(url, [id]);
  part.lastId = id;
}

/** `nextCursor` is 0 when every candidate fit. */
export function selectSafeBrowsingUrls(window: SafeBrowsingWindow): SafeBrowsingSelection {
  const { after, before, max } = window;
  const urls = new Map(after.urls);
  if (after.full) return { urls, nextCursor: after.lastId };

  let lastId = 0;
  for (const [url, ids] of before.urls) {
    const existing = urls.get(url);
    if (existing) {
      existing.push(...ids);
      continue;
    }
    if (urls.size >= max && ids[0] !== lastId) return { urls, nextCursor: lastId };
    urls.set(url, ids);
    lastId = ids[0]!;
  }
  return { urls, nextCursor: before.full ? lastId : 0 };
}
