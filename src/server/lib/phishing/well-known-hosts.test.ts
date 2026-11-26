import { describe, expect, test } from "bun:test";

import { OPEN_REDIRECTORS } from "./heuristics";
import { OPERATOR_SUFFIXES, WELL_KNOWN_HOSTS, isWellKnownHost } from "./well-known-hosts";

// Hosts where anyone can publish a page. A phishing page there inherits the host's reputation,
// so they must keep the LLM check.
const USER_CONTENT_HOSTS = [
  "docs.google.com",
  "sites.google.com",
  "forms.gle",
  "drive.google.com",
  "storage.googleapis.com",
  "firebasestorage.googleapis.com",
  "gist.github.com",
  "raw.githubusercontent.com",
  "onedrive.live.com",
  "medium.com",
  "l.facebook.com",
  "lm.facebook.com",
];

const USER_CONTENT_SUFFIXES = [
  ".github.io",
  ".pages.dev",
  ".workers.dev",
  ".vercel.app",
  ".netlify.app",
  ".blogspot.com",
  ".notion.site",
  ".wixsite.com",
  ".weebly.com",
  ".s3.amazonaws.com",
  ".amazonaws.com",
  ".googleapis.com",
  ".appspot.com",
  ".web.app",
  ".firebaseapp.com",
  ".herokuapp.com",
  ".azurewebsites.net",
  ".blob.core.windows.net",
  ".cloudfront.net",
  ".r2.dev",
  ".glitch.me",
  ".replit.app",
  ".framer.website",
  ".webflow.io",
  ".carrd.co",
  ".wordpress.com",
  ".square.site",
  ".myshopify.com",
  ".sharepoint.com",
  ".medium.com",
];

// Every hostname `isWellKnownHost` can match through an entry: the entry itself and its `www.`
// counterpart.
const withWwwVariants = (host: string) =>
  host.startsWith("www.") ? [host, host.slice(4)] : [host, `www.${host}`];

const servesUserContent = (host: string) =>
  USER_CONTENT_HOSTS.includes(host) ||
  USER_CONTENT_SUFFIXES.some((suffix) => host.endsWith(suffix) || host === suffix.slice(1));

describe("WELL_KNOWN_HOSTS", () => {
  test.each([...WELL_KNOWN_HOSTS])("%s does not serve user-controlled pages", (host) => {
    for (const variant of withWwwVariants(host)) {
      expect(servesUserContent(variant)).toBe(false);
    }
  });

  // An open redirector forwards to any page, so its redirect paths must keep the scrape and LLM.
  test.each([...WELL_KNOWN_HOSTS])("%s does not skip checks on open-redirect paths", (host) => {
    for (const variant of withWwwVariants(host)) {
      for (const redirector of OPEN_REDIRECTORS.filter((r) => r.host.test(variant))) {
        for (const path of redirector.paths) {
          const url = `https://${variant}${path}x?q=https%3A%2F%2Fevil.example`;
          expect(isWellKnownHost(url)).toBe(false);
        }
      }
    }
  });

  test.each([...WELL_KNOWN_HOSTS])("%s is a bare lowercase hostname", (host) => {
    expect(new URL(`https://${host}/`).hostname).toBe(host);
  });
});

describe("OPERATOR_SUFFIXES", () => {
  test.each([...OPERATOR_SUFFIXES])("%s has no user-content hosts under it", (suffix) => {
    expect(servesUserContent(suffix)).toBe(false);
    for (const host of USER_CONTENT_HOSTS) {
      expect(host === suffix || host.endsWith(`.${suffix}`)).toBe(false);
    }
    for (const userSuffix of USER_CONTENT_SUFFIXES) {
      expect(userSuffix.endsWith(`.${suffix}`) || suffix.endsWith(userSuffix)).toBe(false);
    }
  });

  test.each([...OPERATOR_SUFFIXES])("%s is a bare lowercase hostname", (suffix) => {
    expect(new URL(`https://${suffix}/`).hostname).toBe(suffix);
  });
});

describe("isWellKnownHost", () => {
  test("matches listed hosts regardless of case, port, path or scheme", () => {
    expect(isWellKnownHost("https://github.com/AmoabaKelvin/ishortn.ink")).toBe(true);
    expect(isWellKnownHost("https://GitHub.com:443/x")).toBe(true);
    expect(isWellKnownHost("http://www.youtube.com/watch?v=abc")).toBe(true);
  });

  test.each([
    "https://wikipedia.org/",
    "https://www.wikipedia.org/?p=1",
    "https://de.wikipedia.org/wiki/Berlin",
    "https://bbc.com/?p=1",
    "https://www.bbc.co.uk/news",
    "https://www.github.com/AmoabaKelvin",
    "https://youtube.com/watch?v=abc",
    "https://news.ycombinator.com/?p=1",
    "https://www.google.com/search?q=ishortn",
    "https://google.com/maps",
    "https://www.facebook.com/ishortn",
    "https://apps.apple.com/app/id1",
  ])("matches %s", (url) => {
    expect(isWellKnownHost(url)).toBe(true);
  });

  test("matches listed hosts and operator subdomains only", () => {
    expect(isWellKnownHost("https://someone.github.io/")).toBe(false);
    expect(isWellKnownHost("https://user.github.io/")).toBe(false);
    expect(isWellKnownHost("https://gist.github.com/someone/1")).toBe(false);
    expect(isWellKnownHost("https://github.com.evil.com/")).toBe(false);
    expect(isWellKnownHost("https://evilgithub.com/")).toBe(false);
    expect(isWellKnownHost("https://wikipedia.org.evil.com/")).toBe(false);
    expect(isWellKnownHost("https://evilwikipedia.org/")).toBe(false);
    expect(isWellKnownHost("https://www.www.github.com/")).toBe(false);
  });

  // Each user-content host, its `www.` counterpart and a subdomain under each user-content suffix
  // must keep the scrape and LLM check.
  test.each([
    ...USER_CONTENT_HOSTS.flatMap(withWwwVariants),
    ...USER_CONTENT_SUFFIXES.flatMap((suffix) => [`user${suffix}`, `www.user${suffix}`]),
  ])("does not match user-content host %s", (host) => {
    expect(isWellKnownHost(`https://${host}/page`)).toBe(false);
  });

  test.each([
    "https://www.youtube.com/redirect?q=https%3A%2F%2Fevil.example%2Flogin",
    "https://youtube.com/redirect?q=https%3A%2F%2Fevil.example%2Flogin",
    "https://m.youtube.com/redirect?q=https%3A%2F%2Fevil.example%2Flogin",
    "https://www.youtube.com/REDIRECT?q=https%3A%2F%2Fevil.example%2Flogin",
    "https://www.linkedin.com/redir/redirect?url=https%3A%2F%2Fevil.example",
    "https://www.google.com/url?q=https%3A%2F%2Fevil.example",
    "https://google.com/url?q=https%3A%2F%2Fevil.example",
    "https://www.google.com/aclk?adurl=https%3A%2F%2Fevil.example",
    "https://www.facebook.com/l.php?u=https%3A%2F%2Fevil.example",
    "https://facebook.com/l.php?u=https%3A%2F%2Fevil.example",
    "https://l.facebook.com/l.php?u=https%3A%2F%2Fevil.example",
  ])("excludes open-redirect URL %s", (url) => {
    expect(isWellKnownHost(url)).toBe(false);
  });

  test("returns false for unparseable URLs", () => {
    expect(isWellKnownHost("not a url")).toBe(false);
  });
});
