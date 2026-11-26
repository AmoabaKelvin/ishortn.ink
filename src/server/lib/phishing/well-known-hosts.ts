import { isOpenRedirect } from "./heuristics";

/**
 * Exact hostnames of major sites where the LLM phishing check adds nothing: the operator controls
 * every page, so a phishing page can't be published there. URLs on these hosts still go through
 * the heuristics, the blocklist and Safe Browsing / Web Risk; only the page scrape and the LLM call
 * are skipped.
 *
 * Exact hosts only, never a suffix match. Hosts that serve user-controlled pages (Google Docs,
 * Sites and Forms, GitHub Pages, cloud storage buckets, page builders, hosting platforms) must
 * never be added; `well-known-hosts.test.ts` enforces that. Open-redirect paths on listed hosts
 * (`www.youtube.com/redirect`, `www.linkedin.com/redir/`) are excluded: the page they land on is
 * what the LLM needs to judge.
 */
export const WELL_KNOWN_HOSTS: ReadonlySet<string> = new Set([
  "github.com",
  "www.youtube.com",
  "youtube.com",
  "m.youtube.com",
  "youtu.be",
  "en.wikipedia.org",
  "www.bbc.com",
  "www.nytimes.com",
  "www.amazon.com",
  "www.linkedin.com",
  "x.com",
]);

export function isWellKnownHost(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  // `hostname` is lowercased and excludes the port, so "GitHub.com:443" matches while
  // "github.com.evil.com" and "gist.github.com" do not.
  return WELL_KNOWN_HOSTS.has(parsed.hostname) && !isOpenRedirect(parsed);
}
