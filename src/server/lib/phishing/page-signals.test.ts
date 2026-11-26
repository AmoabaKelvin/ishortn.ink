import { describe, expect, mock, test } from "bun:test";

import { TRPCError } from "@trpc/server";

import { parseScrapedPage } from "@/server/lib/metadata";

import { CREDENTIAL_FORM_REASON, USER_MSG_UNSAFE, assertUrlSafe } from "./index";

import type { SafetyAccount, UrlSafetyOptions } from "./index";
import type { Plan } from "@/lib/billing/plans";
import type { ScrapedPage } from "@/server/lib/metadata";

const NOW = new Date("2026-11-26T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const PASS = { blocked: false, reason: "", userMessage: "" };
const SUSPICIOUS = "This URL looks suspicious";

// A page-builder site left on its default title, with the brand only in an image.
const WEBMAIL_FORM_HTML = `<!doctype html>
<html><head><title>My Framer Site</title><meta name="generator" content="Framer"></head>
<body>
  <script>window.__framer = {"lots": "of state"};</script>
  <img src="/logo.png" alt="Spectrum">
  <h1>Sign In to&nbsp;Webmail</h1>
  <form action="https://collect.mail-sync.top/submit" method="post">
    <input type="email" name="email" placeholder="Email address">
    <input type="password" name="pass">
    <button type="submit">Sign in</button>
  </form>
</body></html>`;

const CHALLENGE_HTML = `<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title></head>
<body><div id="cf-chl-widget-x"></div>
<script>window._cf_chl_opt={cvId: '3', cType: 'managed'};</script></body></html>`;

const COPYRIGHT_HTML = `<!doctype html><html><head>
<title>YouTube Studio &#8212; Copyright Center</title></head>
<body><img src="/yt.svg" alt="YouTube"><h2>Your channel has received a copyright strike</h2>
<p>Submit an appeal within 24 hours to keep your channel.</p>
<a href="/appeal">Start appeal</a></body></html>`;

const SHOP_HTML = `<!doctype html><html><head><title>Blue Ceramic Mug – Acme Store</title>
<meta property="og:title" content="Blue Ceramic Mug">
<script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script></head>
<body><h1>Blue Ceramic Mug</h1><p>$18.00</p>
<form action="/cart/add"><input type="hidden" name="id" value="42"><button>Add to cart</button></form>
<form action="/contact#newsletter"><input type="email" name="contact[email]"><button>Subscribe</button></form>
</body></html>`;

const GOOGLE_FORM_HTML = `<!doctype html><html><head><title>Volunteer sign-up</title></head>
<body><form action="https://docs.google.com/forms/d/e/1FAIpQLSf/formResponse" method="POST">
<input type="email" name="emailAddress" aria-label="Your email">
<input type="text" name="entry.1" aria-label="Your name"></form></body></html>`;

function page(url: string, html: string, status = 200, headers = new Headers()): ScrapedPage {
  return parseScrapedPage(html, url, status, headers);
}

function account(plan: Plan, ageDays: number, isTeam = false): SafetyAccount {
  return { plan, isTeam, createdAt: async () => new Date(NOW.getTime() - ageDays * DAY_MS) };
}

function deps(scraped: ScrapedPage, overrides: UrlSafetyOptions = {}) {
  return {
    preChecks: mock(async (_url: string) => PASS),
    scrape: mock(async (_url: string) => scraped),
    detect: mock(async (url: string) => ({ url, phishing: false })),
    readVerdict: mock(async (_url: string) => false),
    rememberVerdict: mock((_url: string) => {}),
    now: () => NOW,
    ...overrides,
  };
}

async function rejection(promise: Promise<unknown>): Promise<TRPCError | null> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof TRPCError) return error;
    throw error;
  }
  return null;
}

describe("page signals", () => {
  test("reads the credential form, its submit host, visible text and image alts", () => {
    const { metadata, signals } = page("https://spectrum-mail.framer.app/", WEBMAIL_FORM_HTML);

    expect(metadata.title).toBe("My Framer Site");
    expect(signals).toEqual({
      status: 200,
      finalUrl: "https://spectrum-mail.framer.app/",
      hasPasswordInput: true,
      hasEmailInput: true,
      formActionHosts: ["collect.mail-sync.top"],
      visibleText: "Sign In to Webmail Sign in",
      imageAlts: ["Spectrum"],
      isChallenge: false,
    });
  });

  test.each([
    ["unquoted attributes", "<input type=email name=email><input type=password name=p>"],
    [
      "data-* attributes before type",
      `<input data-type="x" type="email"><input data-type="x" type="password">`,
    ],
    [
      "a form-builder field with a generated name",
      `<label>Email</label><input type="text" name="_u123"><input type="password" name="_u124">`,
    ],
  ])("finds the credential form with %s", (_name, html) => {
    const { signals } = page("https://a.framer.app/", html);
    expect(signals.hasPasswordInput).toBe(true);
    expect(signals.hasEmailInput).toBe(true);
  });

  test("a data-type attribute is not read as the input's type", () => {
    const { signals } = page("https://a.example/", `<input data-type="password" name="q">`);
    expect(signals.hasPasswordInput).toBe(false);
  });

  test("a site search box is not an identity field", () => {
    const { signals } = page("https://a.example/", `<input type="search" name="user-search">`);
    expect(signals.hasEmailInput).toBe(false);
  });

  test("caps the visible text", () => {
    const { signals } = page("https://a.example/", `<p>${"word ".repeat(400)}</p>`);
    expect(signals.visibleText.length).toBe(500);
  });

  test("recognises a challenge by its markers, its title or the cf-mitigated header", () => {
    expect(page("https://a.example/", CHALLENGE_HTML, 403).signals.isChallenge).toBe(true);
    const attention = "<title>Attention Required! | Cloudflare</title>";
    expect(page("https://a.example/", attention).signals.isChallenge).toBe(true);
    const header = new Headers({ "cf-mitigated": "challenge" });
    expect(page("https://a.example/", "<p>wait</p>", 403, header).signals.isChallenge).toBe(true);
  });

  test("a normal page behind Cloudflare's bot-detection script is not a challenge", () => {
    expect(page("https://acme.example/", SHOP_HTML).signals.isChallenge).toBe(false);
  });

  test("a non-HTML response has no page signals beyond the status", () => {
    const { signals } = page("https://a.example/file.pdf", "", 200);
    expect(signals.hasPasswordInput).toBe(false);
    expect(parseScrapedPage(null, "https://a.example/f.pdf", 200, new Headers()).signals).toEqual({
      status: 200,
      finalUrl: "https://a.example/f.pdf",
      hasPasswordInput: false,
      hasEmailInput: false,
      formActionHosts: [],
      visibleText: "",
      imageAlts: [],
      isChallenge: false,
    });
  });
});

describe("credential form on a page-builder subdomain", () => {
  test.each(["https://spectrum-mail.framer.app/", "https://webmail-login-7.weebly.com/"])(
    "is rejected for a new free account without asking the LLM: %s",
    async (url) => {
      const d = deps(page(url, WEBMAIL_FORM_HTML));

      const error = await rejection(assertUrlSafe(url, { ...d, account: account("free", 2) }));

      expect(error?.message).toStartWith(SUSPICIOUS);
      expect(d.detect).not.toHaveBeenCalled();
      expect(d.rememberVerdict).not.toHaveBeenCalled();
    },
  );

  test.each([
    ["a paying account", account("pro", 2)],
    ["a team", account("ultra", 1, true)],
    ["a free account older than 14 days", account("free", 30)],
    ["an unknown account", undefined],
  ])("is allowed and flagged for review on %s", async (_name, owner) => {
    const url = "https://spectrum-mail.framer.app/";
    const d = deps(page(url, WEBMAIL_FORM_HTML));

    const result = await assertUrlSafe(url, { ...d, account: owner });

    expect(result.outcome).toBe("flagged-credential-form");
    expect(result.followUp).toMatchObject({ kind: "review", reason: CREDENTIAL_FORM_REASON });
    expect(d.detect).toHaveBeenCalledTimes(1);
    expect(d.rememberVerdict).not.toHaveBeenCalled();
  });

  test("is still blocked when the LLM calls it phishing on a paying account", async () => {
    const url = "https://spectrum-mail.framer.app/";
    const d = deps(page(url, WEBMAIL_FORM_HTML), {
      detect: mock(async (u: string) => ({ url: u, phishing: true })),
    });

    const error = await rejection(assertUrlSafe(url, { ...d, account: account("pro", 2) }));

    expect(error?.message).toBe(USER_MSG_UNSAFE);
  });

  test("a password-only form (a protected post or file share) is left to the LLM", async () => {
    const url = "https://someblog.wordpress.com/private-notes/";
    const html = `<title>Protected: notes</title><form action="/wp-login.php?action=postpass">
      <input name="post_password" type="password"><input type="submit" value="Enter"></form>`;
    const d = deps(page(url, html));

    const result = await assertUrlSafe(url, { ...d, account: account("free", 2) });

    expect(result.outcome).toBe("allowed");
  });

  test("a prefilled hidden email field counts as the identity field", async () => {
    const url = "https://office-docs-share.pages.dev/";
    const html = `<form><input type="hidden" name="login_email" value="a@b.example">
      <input type="password" name="pw"></form>`;
    const d = deps(page(url, html));

    const error = await rejection(assertUrlSafe(url, { ...d, account: account("free", 2) }));

    expect(error?.message).toStartWith(SUSPICIOUS);
  });

  test("an unquoted form on a new free account is rejected", async () => {
    const url = "https://spectrum-mail.framer.app/";
    const html =
      "<h1>Sign In to Webmail</h1><input type=email name=email><input type=password name=p>";
    const d = deps(page(url, html));

    const error = await rejection(assertUrlSafe(url, { ...d, account: account("free", 2) }));

    expect(error?.message).toStartWith(SUSPICIOUS);
  });

  test("does not apply to the platform's own sign-in page", async () => {
    const url = "https://www.weebly.com/login";
    const d = deps(page(url, WEBMAIL_FORM_HTML));

    const result = await assertUrlSafe(url, { ...d, account: account("free", 2) });

    expect(result.outcome).toBe("allowed");
  });
});

describe("challenge and error pages", () => {
  const url = "https://secure-docs.example/view";

  test("a 403 challenge is unverified: no cached verdict, queued for a re-check", async () => {
    const d = deps(page(url, CHALLENGE_HTML, 403));

    const result = await assertUrlSafe(url, { ...d, account: account("free", 2) });

    expect(result).toEqual({
      outcome: "unverified-challenge",
      followUp: { kind: "recheck", reason: "unverified-challenge" },
    });
    expect(d.rememberVerdict).not.toHaveBeenCalled();
  });

  test("a challenge served with status 200 is unverified too", async () => {
    const d = deps(page(url, CHALLENGE_HTML, 200));

    expect((await assertUrlSafe(url, d)).outcome).toBe("unverified-challenge");
    expect(d.rememberVerdict).not.toHaveBeenCalled();
  });

  test("a 503 error page is unverified", async () => {
    const d = deps(page(url, "<title>Service Unavailable</title>", 503));

    expect((await assertUrlSafe(url, d)).followUp).toEqual({
      kind: "recheck",
      reason: "unverified-challenge",
    });
  });

  test("the LLM can still block it on the URL alone", async () => {
    const d = deps(page(url, CHALLENGE_HTML, 403), {
      detect: mock(async (u: string) => ({ url: u, phishing: true })),
    });

    expect((await rejection(assertUrlSafe(url, d)))?.message).toBe(USER_MSG_UNSAFE);
  });

  test("a failed scrape is queued for a re-check", async () => {
    const d = deps(page(url, ""), {
      scrape: mock(async () => {
        throw new Error("fetch failed");
      }),
    });

    expect(await assertUrlSafe(url, d)).toEqual({
      outcome: "scrape-failed",
      followUp: { kind: "recheck", reason: "scrape-failed" },
    });
  });
});

describe("brand lure on an unrelated domain", () => {
  test("goes to the LLM with the page signals", async () => {
    const url = "https://studio-copyright-review.cfd/appeal";
    const scraped = page(url, COPYRIGHT_HTML);
    const d = deps(scraped, { detect: mock(async (u: string) => ({ url: u, phishing: true })) });

    const error = await rejection(assertUrlSafe(url, { ...d, account: account("free", 1) }));

    expect(error?.message).toBe(USER_MSG_UNSAFE);
    expect(d.detect).toHaveBeenCalledWith(url, scraped.metadata, scraped.signals);
    expect(scraped.metadata.title).toBe("YouTube Studio — Copyright Center");
    expect(scraped.signals.imageAlts).toEqual(["YouTube"]);
    expect(scraped.signals.visibleText).toContain("copyright strike");
  });
});

describe("ordinary pages", () => {
  test.each([
    ["a shop product page", "https://acme-store.myshopify.com/products/blue-mug", SHOP_HTML],
    ["a Google Form", "https://docs.google.com/forms/d/e/1FAIpQLSf/viewform", GOOGLE_FORM_HTML],
  ])("%s is allowed and its verdict cached", async (_name, url, html) => {
    const d = deps(page(url, html));

    const result = await assertUrlSafe(url, { ...d, account: account("free", 1) });

    expect(result).toEqual({ outcome: "allowed", followUp: undefined });
    expect(d.rememberVerdict).toHaveBeenCalledWith(url);
  });
});
