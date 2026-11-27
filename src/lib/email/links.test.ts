import { describe, expect, test } from "bun:test";

import { ALL_EMAIL_LINKS, EMAIL_LINKS, emailLinkUrl } from "./links";

const links = ALL_EMAIL_LINKS;

describe("email links", () => {
  test("every alias is unique, fits Link.alias and follows e-<template>-<cta>", () => {
    const aliases = links.map((link) => link.alias);
    expect(new Set(aliases).size).toBe(aliases.length);
    for (const alias of aliases) {
      expect(alias.length).toBeLessThanOrEqual(20);
      expect(alias).toMatch(/^e-[a-z0-9]+(-[a-z0-9]+)+$/);
    }
  });

  test("destinations are clean app paths and the tags live on the link", () => {
    for (const { path, utm } of links) {
      expect(path).toStartWith("/");
      expect(path).not.toContain("utm_");
      expect(utm.utm_source).toBe("email");
      expect(["lifecycle", "transactional"]).toContain(utm.utm_medium);
      expect(utm.utm_campaign).not.toBe("");
      expect(utm.utm_content).not.toBe("");
    }
  });

  test("each template's buttons are told apart by utm_content", () => {
    const keys = links.map(({ utm }) => `${utm.utm_campaign}/${utm.utm_content}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("checkout links keep their pricing source", () => {
    expect(EMAIL_LINKS.eventUsage.pro[100].path).toBe(
      "/dashboard/pricing?highlight=pro&source=events_email_100",
    );
    expect(EMAIL_LINKS.upgradeNudge.links.path).toBe(
      "/dashboard/pricing?highlight=pro&source=upgrade_nudge",
    );
  });

  test("the short link is on the app domain", () => {
    expect(emailLinkUrl(EMAIL_LINKS.welcome.createLink)).toBe("https://ishortn.ink/e-welcome-link");
  });
});
