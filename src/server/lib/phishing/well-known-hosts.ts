import { isOpenRedirect } from "./heuristics";

/**
 * Hostnames of major sites where the LLM phishing check adds nothing: the operator controls
 * every page, so a phishing page can't be published there. URLs on these hosts still go through
 * the heuristics, the blocklist and Safe Browsing / Web Risk; only the page scrape and the LLM call
 * are skipped.
 *
 * Exact hosts, with `www.` treated as optional (`github.com` also matches `www.github.com`).
 * Hosts that serve user-controlled pages (Google Docs, Sites and Forms, GitHub Pages, cloud storage
 * buckets, page builders, hosting platforms, blogs) must never be added; `well-known-hosts.test.ts`
 * enforces that. Open-redirect paths on listed hosts (`www.youtube.com/redirect`,
 * `www.google.com/url`, `www.facebook.com/l.php`) are excluded: the page they land on is what the
 * LLM needs to judge.
 */
export const WELL_KNOWN_HOSTS: ReadonlySet<string> = new Set([
  "github.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.amazon.com",
  "www.linkedin.com",
  "x.com",
  "www.google.com",
  "play.google.com",
  "open.spotify.com",
  "www.instagram.com",
  "www.facebook.com",
  "www.tiktok.com",
  "www.reddit.com",
  "www.imdb.com",
  "www.ebay.com",
  "www.etsy.com",
]);

/**
 * Registrable domains where every subdomain is run by the operator, matched on a dot boundary
 * (`de.wikipedia.org` matches, `evilwikipedia.org` and `wikipedia.org.evil.com` do not). Only add a
 * domain here if no subdomain can be claimed or published to by a third party.
 */
export const OPERATOR_SUFFIXES: readonly string[] = [
  // Wikimedia projects: language subdomains are all wiki content served by the foundation.
  "wikipedia.org",
  "wikimedia.org",
  "wiktionary.org",
  // BBC sites: news, sport and iPlayer subdomains are all BBC-published.
  "bbc.co.uk",
  "bbc.com",
  // Newsrooms: subdomains host the publisher's own sections and apps.
  "nytimes.com",
  "theguardian.com",
  "reuters.com",
  // Apple: support, apps and developer subdomains are Apple-run; user storage lives on icloud.com.
  "apple.com",
  // Stack Overflow: Q&A is moderated and rendered by the operator; no user-hosted pages.
  "stackoverflow.com",
  // Y Combinator: news.ycombinator.com and the company directory are operator-rendered.
  "ycombinator.com",
];

function hostMatches(hostname: string): boolean {
  if (WELL_KNOWN_HOSTS.has(hostname)) return true;
  const toggled = hostname.startsWith("www.") ? hostname.slice(4) : `www.${hostname}`;
  if (WELL_KNOWN_HOSTS.has(toggled)) return true;
  return OPERATOR_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
}

export function isWellKnownHost(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  // `hostname` is lowercased and excludes the port, so "GitHub.com:443" matches while
  // "github.com.evil.com" and "gist.github.com" do not.
  return hostMatches(parsed.hostname) && !isOpenRedirect(parsed);
}
