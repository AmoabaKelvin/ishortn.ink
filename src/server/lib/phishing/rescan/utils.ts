export type RescanSource =
  | "phishing-database-links"
  | "phishing-database-domains"
  | "openphish"
  | "urlhaus"
  | "safe-browsing";

export type FeedKind = "url" | "domain";

export type ScanLink = { id: number; url: string | null; domain: string; alias: string | null };

export type MatchKind = "url" | "short-link" | "domain" | "threat";

export type RescanMatch = {
  linkId: number;
  source: RescanSource;
  kind: MatchKind;
  /** Feed entry or threat types that matched, kept for the admin review details. */
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
};

export type ExistingFlag = {
  linkId: number;
  status: "pending" | "blocked" | "dismissed";
  reason: string | null;
};

export const RESCAN_REASON_PREFIX = "phishing-rescan:";

// Multi-tenant hosting, link-in-bio, shortener, file-sharing and IPFS platforms: a subdomain or
// path belongs to one customer, so a domain-level feed hit never justifies blocking the platform.
// Built from the most frequent parents in the Phishing.Database domains feed.
const SHARED_HOST_SUFFIXES = [
  "000webhostapp.com",
  "123formbuilder.com",
  "amazonaws.com",
  "angelfire.com",
  "appdomain.cloud",
  "appspot.com",
  "arweave.net",
  "azurewebsites.net",
  "beacons.ai",
  "biz.id",
  "bio.link",
  "bit.do",
  "bit.ly",
  "blinq.me",
  "blogspot.com",
  "box.com",
  "canva.site",
  "carrd.co",
  "cf-ipfs.com",
  "cloudfront.net",
  "come.to",
  "core.windows.net",
  "cprapid.com",
  "ddns.net",
  "dropbox.com",
  "duckdns.org",
  "dweb.link",
  "editorx.io",
  "ewp.live",
  "ffm.to",
  "filesusr.com",
  "firebaseapp.com",
  "fleek.co",
  "framer.app",
  "framer.website",
  "geocities.ws",
  "gitbook.io",
  "github.io",
  "gitlab.io",
  "glitch.me",
  "godaddysites.com",
  "herokuapp.com",
  "hoo.be",
  "infura-ipfs.io",
  "ipfs.io",
  "is.gd",
  "jimdosite.com",
  "jotform.com",
  "linklist.bio",
  "linktr.ee",
  "lynk.id",
  "mediafire.com",
  "medium.com",
  "mez.ink",
  "msha.ke",
  "my.id",
  "myshopify.com",
  "mystrikingly.com",
  "netlify.app",
  "nftstorage.link",
  "ngrok-free.app",
  "ngrok.io",
  "notion.site",
  "pages.dev",
  "pantheonsite.io",
  "pastebin.com",
  "plesk.page",
  "r2.dev",
  "repl.co",
  "replit.app",
  "replit.dev",
  "sharepoint.com",
  "square.site",
  "squarespace.com",
  "strikingly.com",
  "substack.com",
  "surge.sh",
  "t.co",
  "taplink.cc",
  "teachable.com",
  "telegra.ph",
  "tinyurl.com",
  "trycloudflare.com",
  "tumblr.com",
  "typedream.app",
  "typeform.com",
  "unbouncepages.com",
  "usrfiles.com",
  "vercel.app",
  "w3s.link",
  "web.app",
  "webflow.io",
  "weebly.com",
  "weeblysite.com",
  "wixsite.com",
  "wixstudio.io",
  "wordpress.com",
  "workers.dev",
  "yolasite.com",
];

// Large sites that the feeds list as whole domains or bare home pages (docs.google.com,
// sites.google.com, notion.so, gravatar.com, ...). Matches on these only ever raise a flag.
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

export type LinkIndex = {
  byUrl: Map<string, number[]>;
  byHost: Map<string, number[]>;
  /** `domain/alias` (alias lowercased, as aliases resolve case-insensitively) of each short link. */
  byShortUrl: Map<string, number>;
  /** Our short-link domains: never blocklisted, and feed URLs on them are matched to aliases. */
  ownHosts: Set<string>;
};

export function createLinkIndex(platformDomains: readonly string[]): LinkIndex {
  return {
    byUrl: new Map(),
    byHost: new Map(),
    byShortUrl: new Map(),
    ownHosts: new Set(platformDomains),
  };
}

function push(map: Map<string, number[]>, key: string, id: number) {
  const ids = map.get(key);
  if (ids) ids.push(id);
  else map.set(key, [id]);
}

export function addLinkToIndex(index: LinkIndex, link: ScanLink): void {
  const ownHost = normalizeHost(link.domain);
  if (ownHost) {
    index.ownHosts.add(ownHost);
    if (link.alias) index.byShortUrl.set(`${ownHost}/${link.alias.toLowerCase()}`, link.id);
  }

  const key = link.url ? normalizeUrl(link.url) : null;
  if (!key) return;
  push(index.byUrl, key, link.id);
  const host = hostOfUrl(key);
  if (host) push(index.byHost, host, link.id);
}

export function matchFeedEntry(
  index: LinkIndex,
  source: RescanSource,
  kind: FeedKind,
  entry: string,
): RescanMatch[] {
  if (kind === "domain") {
    const host = normalizeHost(entry);
    const ids = host ? index.byHost.get(host) : undefined;
    return ids ? ids.map((linkId) => ({ linkId, source, kind: "domain", entry, host: host! })) : [];
  }

  const host = hostOfUrl(entry);
  if (!host || (!index.byHost.has(host) && !index.ownHosts.has(host))) return [];
  const key = normalizeUrl(entry);
  if (!key) return [];

  const matches: RescanMatch[] = (index.byUrl.get(key) ?? []).map((linkId) => ({
    linkId,
    source,
    kind: "url",
    entry,
    host,
  }));

  // The feed lists one of our short links itself (e.g. ishortn.ink/qsoi5tx8i).
  if (index.ownHosts.has(host)) {
    const alias = key.slice(host.length + 1);
    const linkId = key.startsWith(`${host}/`)
      ? index.byShortUrl.get(`${host}/${alias.toLowerCase()}`)
      : undefined;
    if (linkId !== undefined && !alias.includes("/") && !alias.includes("?")) {
      matches.push({ linkId, source, kind: "short-link", entry, host });
    }
  }

  return matches;
}

export function decideMatch(match: RescanMatch, ownHosts: ReadonlySet<string>): RescanDecision {
  const reason = `${RESCAN_REASON_PREFIX} ${match.source}`;
  const base = { linkId: match.linkId, source: match.source, reason };

  switch (match.kind) {
    case "threat":
      return { ...base, action: "block", details: `Safe Browsing threat: ${match.entry}` };
    case "short-link":
      return { ...base, action: "block", details: `Short link listed in feed: ${match.entry}` };
    case "url": {
      const key = normalizeUrl(match.entry) ?? "";
      if (isHomePageKey(key) && isProtectedHost(match.host, ownHosts)) {
        return {
          ...base,
          action: "flag",
          details: `Feed lists the home page of a shared or major host: ${match.entry}`,
        };
      }
      return { ...base, action: "block", details: `Destination listed in feed: ${match.entry}` };
    }
    case "domain":
      if (isSharedHost(match.host, ownHosts)) {
        return {
          ...base,
          action: "flag",
          details: `Destination host listed in feed, on a shared host: ${match.entry}`,
        };
      }
      return {
        ...base,
        action: "block",
        details: `Destination host listed in feed: ${match.entry}`,
        blockDomain: match.host,
      };
  }
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

/**
 * Drops decisions an admin has already ruled on: a dismissed flag means the link was reviewed and
 * kept, and an earlier rescan block on a link that is live again means an admin unblocked it.
 * A pending rescan flag isn't raised twice but can still be upgraded to a block.
 */
export function withoutResolvedLinks(
  decisions: RescanDecision[],
  existing: ExistingFlag[],
): RescanDecision[] {
  const skip = new Set<number>();
  const pending = new Set<number>();
  for (const flag of existing) {
    const fromRescan = flag.reason?.startsWith(RESCAN_REASON_PREFIX) ?? false;
    if (flag.status === "dismissed" || (fromRescan && flag.status === "blocked")) {
      skip.add(flag.linkId);
    } else if (fromRescan) {
      pending.add(flag.linkId);
    }
  }
  return decisions.filter(
    (d) => !skip.has(d.linkId) && !(d.action === "flag" && pending.has(d.linkId)),
  );
}

/**
 * Caps automatic blocks per run so a bad feed update can't take down a large share of links;
 * blocks over the cap are raised as pending flags for an admin instead.
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
    };
  });
}

export type SafeBrowsingCandidate = { id: number; url: string };

export type SafeBrowsingSelection = { urls: Map<string, number[]>; nextCursor: number };

/**
 * Picks up to `max` distinct URLs starting after the link id where the previous run stopped,
 * wrapping around, so links that went longest without a check go first. `nextCursor` is 0 when
 * every candidate fit.
 */
export function selectSafeBrowsingUrls(
  candidates: SafeBrowsingCandidate[],
  cursor: number,
  max: number,
): SafeBrowsingSelection {
  const start = candidates.findIndex((c) => c.id > cursor);
  const ordered =
    start <= 0 ? candidates : [...candidates.slice(start), ...candidates.slice(0, start)];

  const urls = new Map<string, number[]>();
  for (let i = 0; i < ordered.length; i++) {
    const candidate = ordered[i]!;
    const ids = urls.get(candidate.url);
    if (ids) {
      ids.push(candidate.id);
      continue;
    }
    if (urls.size === max) return { urls, nextCursor: ordered[i - 1]!.id };
    urls.set(candidate.url, [candidate.id]);
  }
  return { urls, nextCursor: 0 };
}
