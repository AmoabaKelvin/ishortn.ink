import { describe, expect, it } from "bun:test";

import { DELETION_CASCADE_REASON } from "@/lib/account-deletion/constants";

import {
  INACTIVE_LINK_MESSAGE,
  UNSAFE_LINK_MESSAGE,
  getBlockedLinkMessage,
  getSignupUrl,
  isPlatformHost,
} from "./utils";

describe("getBlockedLinkMessage", () => {
  it("reports safety blocks as unsafe without the internal reason", () => {
    for (const reason of [
      "phishing-rescan: phishing-database-domains",
      "phishing-rescan: safe-browsing",
      "phishing-rescan:content",
      "Google Safe Browsing flagged this URL: MALWARE",
      "Google Web Risk flagged this URL: SOCIAL_ENGINEERING",
      'Domain "bad.example" is on the blocklist: scam',
      "Abuse report #12",
    ]) {
      expect(getBlockedLinkMessage(reason)).toBe(UNSAFE_LINK_MESSAGE);
    }
  });

  it("reports owner bans, deletions and anything else as inactive", () => {
    for (const reason of [
      "Owner account banned",
      DELETION_CASCADE_REASON,
      "Requested by owner",
      "",
      null,
    ]) {
      expect(getBlockedLinkMessage(reason)).toBe(INACTIVE_LINK_MESSAGE);
    }
  });
});

describe("isPlatformHost", () => {
  it("brands platform domains, team subdomains and local hosts", () => {
    for (const host of [
      "isht.app",
      "ishortn.ink",
      "isht.ink:443",
      "acme.isht.app",
      "localhost:3000",
      "127.0.0.1:8787",
      "ishortn.example.workers.dev",
      null,
    ]) {
      expect(isPlatformHost(host)).toBe(true);
    }
  });

  it("keeps custom domains neutral", () => {
    for (const host of ["go.brand.com", "brand.com", "ishortn.ink.evil.com"]) {
      expect(isPlatformHost(host)).toBe(false);
    }
  });
});

describe("getSignupUrl", () => {
  it("tags the homepage link with the campaign", () => {
    expect(getSignupUrl("password")).toBe(
      "https://ishortn.ink/?utm_source=short_link&utm_medium=referral&utm_campaign=password",
    );
    expect(getSignupUrl("expired")).toBe(
      "https://ishortn.ink/?utm_source=short_link&utm_medium=referral&utm_campaign=expired",
    );
  });
});
