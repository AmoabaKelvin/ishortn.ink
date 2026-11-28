import { describe, expect, mock, test } from "bun:test";

import { parseScrapedPage } from "@/server/lib/metadata";

import { checkLinkContent } from "./content";
import {
  CONTENT_REASON,
  checksDueBy,
  cloakingRedirect,
  contentDecision,
  isContentCheckDue,
  pageSignalCheck,
  selectsForContentCheck,
} from "./content-utils";
import { capBlocks, flagPayingAccounts } from "./utils";

import type { ContentLink } from "./content-utils";

const NOW = new Date("2026-11-26T12:00:00Z");
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const ago = (ms: number) => new Date(NOW.getTime() - ms);

const KIT_URL = "https://secure-login.weebly.com/verify";

const CHALLENGE_HTML = `<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title></head>
<body><div id="cf-chl-widget-x"></div>
<script>window._cf_chl_opt={cvId: '3', cType: 'managed'};</script></body></html>`;

const LOGIN_HTML = `<!doctype html><html><head><title>My Site</title></head><body>
  <img src="/logo.png" alt="Microsoft">
  <form action="https://collect.mail-sync.top/submit" method="post">
    <input type="email" name="email"><input type="password" name="pass">
  </form>
</body></html>`;

const PLAIN_HTML = `<!doctype html><html><head><title>Bake sale</title></head>
<body><p>Saturday at the school hall.</p></body></html>`;

function page(html: string, finalUrl = KIT_URL, status = 200) {
  return parseScrapedPage(html, finalUrl, status, new Headers({ "content-type": "text/html" }));
}

function newLink(overrides: Partial<ContentLink> = {}): ContentLink {
  return {
    url: KIT_URL,
    createdAt: ago(40 * MINUTE_MS),
    blocked: false,
    teamId: null,
    ownerCreatedAt: ago(2 * DAY_MS),
    paying: false,
    unverifiedAtCreation: false,
    ...overrides,
  };
}

describe("selectsForContentCheck", () => {
  test("selects a new link from a new free account", () => {
    expect(selectsForContentCheck(newLink(), NOW)).toBe(true);
  });

  test("leaves out accounts of 14 days or more, paying accounts and teams", () => {
    expect(selectsForContentCheck(newLink({ ownerCreatedAt: ago(14 * DAY_MS) }), NOW)).toBe(false);
    expect(selectsForContentCheck(newLink({ ownerCreatedAt: ago(13 * DAY_MS) }), NOW)).toBe(true);
    expect(selectsForContentCheck(newLink({ paying: true }), NOW)).toBe(false);
    expect(selectsForContentCheck(newLink({ teamId: 7 }), NOW)).toBe(false);
    expect(selectsForContentCheck(newLink({ ownerCreatedAt: null }), NOW)).toBe(false);
  });

  test("leaves out links older than 48 hours", () => {
    expect(selectsForContentCheck(newLink({ createdAt: ago(47 * HOUR_MS) }), NOW)).toBe(true);
    expect(selectsForContentCheck(newLink({ createdAt: ago(49 * HOUR_MS) }), NOW)).toBe(false);
  });

  test("leaves out blocked links, well-known hosts and non-web URLs", () => {
    expect(selectsForContentCheck(newLink({ blocked: true }), NOW)).toBe(false);
    expect(selectsForContentCheck(newLink({ url: "https://github.com/acme" }), NOW)).toBe(false);
    expect(selectsForContentCheck(newLink({ url: "https://www.github.com/acme" }), NOW)).toBe(
      false,
    );
    expect(selectsForContentCheck(newLink({ url: "mailto:a@b.co" }), NOW)).toBe(false);
    expect(selectsForContentCheck(newLink({ url: null }), NOW)).toBe(false);
  });

  test("only exact well-known hosts are left out", () => {
    expect(selectsForContentCheck(newLink({ url: "https://gist.github.com/acme" }), NOW)).toBe(
      true,
    );
    expect(selectsForContentCheck(newLink({ url: "https://www.google.com/url?q=x" }), NOW)).toBe(
      true,
    );
  });

  test("selects links the creation check couldn't verify, whatever the account", () => {
    const unverified = { unverifiedAtCreation: true };
    expect(
      selectsForContentCheck(newLink({ ...unverified, ownerCreatedAt: ago(400 * DAY_MS) }), NOW),
    ).toBe(true);
    expect(selectsForContentCheck(newLink({ ...unverified, paying: true, teamId: 3 }), NOW)).toBe(
      true,
    );
    expect(selectsForContentCheck(newLink({ ...unverified, blocked: true }), NOW)).toBe(false);
  });
});

describe("re-check times", () => {
  test("the first check is due 30 minutes after creation, the second after 24 hours", () => {
    expect(checksDueBy(ago(29 * MINUTE_MS), NOW)).toBe(0);
    expect(checksDueBy(ago(30 * MINUTE_MS), NOW)).toBe(1);
    expect(checksDueBy(ago(23 * HOUR_MS), NOW)).toBe(1);
    expect(checksDueBy(ago(24 * HOUR_MS), NOW)).toBe(2);
  });

  test("a done check isn't due again until the next check time", () => {
    expect(isContentCheckDue(ago(29 * MINUTE_MS), 0, NOW)).toBe(false);
    expect(isContentCheckDue(ago(31 * MINUTE_MS), 0, NOW)).toBe(true);
    expect(isContentCheckDue(ago(31 * MINUTE_MS), 1, NOW)).toBe(false);
    expect(isContentCheckDue(ago(23 * HOUR_MS), 1, NOW)).toBe(false);
    expect(isContentCheckDue(ago(25 * HOUR_MS), 1, NOW)).toBe(true);
    expect(isContentCheckDue(ago(25 * HOUR_MS), 2, NOW)).toBe(false);
  });

  test("a missed first check is folded into the second, and nothing runs after 48 hours", () => {
    expect(isContentCheckDue(ago(30 * HOUR_MS), 0, NOW)).toBe(true);
    expect(checksDueBy(ago(30 * HOUR_MS), NOW)).toBe(2);
    expect(isContentCheckDue(ago(49 * HOUR_MS), 0, NOW)).toBe(false);
  });
});

describe("cloakingRedirect", () => {
  test("flags a free-hosting page that lands on a bank, payment or email provider", () => {
    expect(
      cloakingRedirect("https://chase-help.000webhostapp.com/", "https://www.chase.com/"),
    ).toBe("chase.com");
    expect(
      cloakingRedirect("https://acme.netlify.app/", "https://www.bankofamerica.com/en-us/"),
    ).toBe("bankofamerica.com");
    expect(cloakingRedirect("https://x.weebly.com/", "https://www.paypal.com/us/home")).toBe(
      "paypal.com",
    );
    expect(cloakingRedirect("https://x.weebly.com/", "https://www.lloydsbank.com/")).toBe(
      "lloydsbank.com",
    );
  });

  test("ignores sign-in-gated shares and apps sent to their identity provider", () => {
    const microsoftLogin =
      "https://login.microsoftonline.com/common/oauth2/authorize?client_id=00000003&response_type=code";
    const googleLogin = "https://accounts.google.com/v3/signin/identifier?continue=https%3A%2F%2Fx";
    expect(
      cloakingRedirect("https://contoso.sharepoint.com/:b:/s/team/Eab", microsoftLogin),
    ).toBeNull();
    expect(cloakingRedirect("https://contoso.azurewebsites.net/", microsoftLogin)).toBeNull();
    expect(cloakingRedirect("https://acme.web.app/", googleLogin)).toBeNull();
    expect(cloakingRedirect("https://acme.firebaseapp.com/", googleLogin)).toBeNull();
    expect(cloakingRedirect("https://acme.appspot.com/", googleLogin)).toBeNull();
    // Even a bare sign-in host is where sign-in gates go, not a provider's public site.
    expect(
      cloakingRedirect("https://x.weebly.com/", "https://login.microsoftonline.com/"),
    ).toBeNull();
    expect(cloakingRedirect("https://x.weebly.com/", "https://login.live.com/")).toBeNull();
  });

  test("only counts landings on the provider's home page", () => {
    expect(
      cloakingRedirect("https://shop.netlify.app/", "https://www.paypal.com/checkoutnow?token=1"),
    ).toBeNull();
    expect(
      cloakingRedirect("https://x.github.io/", "https://www.chase.com/personal/credit-cards"),
    ).toBeNull();
  });

  test("doesn't treat every name containing 'bank' as a bank", () => {
    expect(cloakingRedirect("https://x.github.io/", "https://www.foodbank.org/")).toBeNull();
    expect(cloakingRedirect("https://x.github.io/", "https://www.bankrate.com/")).toBeNull();
    expect(cloakingRedirect("https://x.github.io/", "https://databank.worldbank.org/")).toBeNull();
  });

  test("ignores redirects that don't start on a free-hosting subdomain", () => {
    expect(cloakingRedirect("https://acme.com/pay", "https://www.paypal.com/checkout")).toBeNull();
    expect(cloakingRedirect("https://weebly.com/", "https://www.paypal.com/")).toBeNull();
  });

  test("ignores redirects to ordinary sites and between free-hosting pages", () => {
    expect(cloakingRedirect("https://x.weebly.com/", "https://www.example.org/")).toBeNull();
    expect(cloakingRedirect("https://x.weebly.com/", "https://mybank.weebly.com/")).toBeNull();
    expect(cloakingRedirect("https://x.weebly.com/", "https://x.weebly.com/home")).toBeNull();
  });
});

describe("pageSignalCheck", () => {
  test("a challenge or error page is unverified", () => {
    expect(pageSignalCheck(KIT_URL, page(CHALLENGE_HTML).signals)).toEqual({ kind: "unverified" });
    expect(pageSignalCheck(KIT_URL, page(PLAIN_HTML, KIT_URL, 503).signals)).toEqual({
      kind: "unverified",
    });
  });

  test("a sign-in form on a free-hosting subdomain is phishing", () => {
    expect(pageSignalCheck(KIT_URL, page(LOGIN_HTML).signals)).toEqual({
      kind: "phishing",
      details: `Password form on shared host secure-login.weebly.com: ${KIT_URL}`,
    });
  });

  test("a cloaking redirect is phishing even when the bank's site shows a challenge", () => {
    const check = pageSignalCheck(KIT_URL, page(CHALLENGE_HTML, "https://www.chase.com/").signals);
    expect(check?.kind).toBe("phishing");
  });

  test("leaves an ordinary page to the LLM", () => {
    expect(pageSignalCheck(KIT_URL, page(PLAIN_HTML).signals)).toBeNull();
  });
});

describe("content decisions", () => {
  const phishing = { kind: "phishing" as const, details: "Password form on shared host x" };

  test("evidence blocks on a free account and flags on a paying or team account", () => {
    const decision = contentDecision(1, phishing);
    expect(decision).toMatchObject({ action: "block", reason: CONTENT_REASON, source: "content" });
    expect(CONTENT_REASON).toBe("phishing-rescan:content");

    const decisions = [decision!, contentDecision(2, phishing)!];
    const applied = flagPayingAccounts(decisions, new Set([2]));
    expect(applied.map((d) => d.action)).toEqual(["block", "flag"]);
    expect(applied[1]!.details).toEndWith("(paying account, review before blocking)");
  });

  test("blocks over the per-run limit wait as flags", () => {
    const decisions = [1, 2, 3].map((id) => contentDecision(id, phishing)!);
    expect(capBlocks(decisions, 2).map((d) => d.action)).toEqual(["block", "block", "flag"]);
  });

  test("clean, unverified and failed checks decide nothing", () => {
    expect(contentDecision(1, { kind: "clean" })).toBeNull();
    expect(contentDecision(1, { kind: "unverified" })).toBeNull();
    expect(contentDecision(1, { kind: "error", error: "timeout" })).toBeNull();
  });
});

describe("checkLinkContent", () => {
  test("a challenge at 30 minutes and a sign-in form at 24 hours blocks a free account's link", async () => {
    const pages = [page(CHALLENGE_HTML), page(LOGIN_HTML)];
    const scrape = mock(async () => pages.shift()!);
    const detect = mock(async (url: string) => ({ url, phishing: false }));

    const first = await checkLinkContent(KIT_URL, { scrape, detect });
    expect(first).toEqual({ kind: "unverified" });
    expect(contentDecision(1, first)).toBeNull();

    const second = await checkLinkContent(KIT_URL, { scrape, detect });
    const [decision] = flagPayingAccounts([contentDecision(1, second)!], new Set());
    expect(decision).toMatchObject({ linkId: 1, action: "block", reason: CONTENT_REASON });
    // The page rules decided both times; the LLM is only asked about pages they can't judge.
    expect(detect).toHaveBeenCalledTimes(0);
  });

  test("asks the LLM about an ordinary page", async () => {
    const scrape = mock(async () => page(PLAIN_HTML));
    const flagged = mock(async (url: string) => ({ url, phishing: true }));
    expect(await checkLinkContent(KIT_URL, { scrape, detect: flagged })).toEqual({
      kind: "phishing",
      details: `LLM flagged the page at ${KIT_URL}`,
    });

    const cleared = mock(async (url: string) => ({ url, phishing: false }));
    expect(await checkLinkContent(KIT_URL, { scrape, detect: cleared })).toEqual({
      kind: "clean",
    });
  });

  test("a failed fetch or LLM call is an error, not a verdict", async () => {
    const detect = mock(async (url: string) => ({ url, phishing: false }));
    const down = mock(async () => {
      throw new Error("timeout");
    });
    expect(await checkLinkContent(KIT_URL, { scrape: down, detect })).toEqual({
      kind: "error",
      error: "timeout",
    });
    const scrape = mock(async () => page(PLAIN_HTML));
    expect(await checkLinkContent(KIT_URL, { scrape, detect: down })).toEqual({
      kind: "error",
      error: "timeout",
    });
  });
});
