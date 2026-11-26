import { describe, expect, test } from "bun:test";

import { WELL_KNOWN_HOSTS, isWellKnownHost } from "./well-known-hosts";

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
];

describe("WELL_KNOWN_HOSTS", () => {
  test.each([...WELL_KNOWN_HOSTS])("%s does not serve user-controlled pages", (host) => {
    expect(USER_CONTENT_HOSTS).not.toContain(host);
    for (const suffix of USER_CONTENT_SUFFIXES) {
      expect(host.endsWith(suffix) || host === suffix.slice(1)).toBe(false);
    }
  });

  test.each([...WELL_KNOWN_HOSTS])("%s is a bare lowercase hostname", (host) => {
    expect(new URL(`https://${host}/`).hostname).toBe(host);
  });
});

describe("isWellKnownHost", () => {
  test("matches listed hosts regardless of case, port, path or scheme", () => {
    expect(isWellKnownHost("https://github.com/AmoabaKelvin/ishortn.ink")).toBe(true);
    expect(isWellKnownHost("https://GitHub.com:443/x")).toBe(true);
    expect(isWellKnownHost("http://www.youtube.com/watch?v=abc")).toBe(true);
  });

  test("matches exact hosts only", () => {
    expect(isWellKnownHost("https://someone.github.io/")).toBe(false);
    expect(isWellKnownHost("https://gist.github.com/someone/1")).toBe(false);
    expect(isWellKnownHost("https://github.com.evil.com/")).toBe(false);
    expect(isWellKnownHost("https://evilgithub.com/")).toBe(false);
    expect(isWellKnownHost("https://wikipedia.org/")).toBe(false);
  });

  test("returns false for unparseable URLs", () => {
    expect(isWellKnownHost("not a url")).toBe(false);
  });
});
