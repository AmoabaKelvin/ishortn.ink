import { describe, expect, test } from "bun:test";

import { sidebarUpgradeReason, visitsUpgradeReason } from "./sidebar-upgrade-reason";

const base = {
  events: { count: 100, limit: 1000 },
  qrCodes: { count: 1, limit: 5 },
  linksAtLimit: false,
  signals: { hiddenClicks: 0, workDomain: null },
};

describe("sidebarUpgradeReason", () => {
  test("leads with visits from 60% of the monthly cap", () => {
    expect(sidebarUpgradeReason({ ...base, events: { count: 599, limit: 1000 } }).source).toBe(
      "sidebar_free",
    );
    expect(
      sidebarUpgradeReason({
        ...base,
        events: { count: 600, limit: 1000 },
        qrCodes: { count: 5, limit: 5 },
        signals: { hiddenClicks: 40, workDomain: "acme.com" },
      }),
    ).toEqual({ source: "sidebar_visits_cap", label: "600 of 1,000 visits used" });
  });

  test("keeps the paused source and caps the count at the limit while tracking is paused", () => {
    expect(visitsUpgradeReason({ count: 1200, limit: 1000, paused: { dropped: 200 } })).toEqual({
      source: "sidebar_events_paused",
      label: "1,000 of 1,000 visits used",
    });
  });

  test("then hidden clicks, pluralised", () => {
    const reason = (hiddenClicks: number) =>
      sidebarUpgradeReason({
        ...base,
        qrCodes: { count: 5, limit: 5 },
        signals: { hiddenClicks, workDomain: "acme.com" },
      });
    expect(reason(1284)).toEqual({
      source: "sidebar_hidden_clicks",
      label: "1,284 older clicks hidden",
      hiddenClicks: 1284,
    });
    expect(reason(1).label).toBe("1 older click hidden");
  });

  test("then the QR code cap", () => {
    expect(
      sidebarUpgradeReason({
        ...base,
        qrCodes: { count: 5, limit: 5 },
        signals: { hiddenClicks: 0, workDomain: "acme.com" },
      }),
    ).toEqual({ source: "sidebar_qr_cap", label: "5/5 QR codes used" });
  });

  test("then a branded domain from a work email", () => {
    expect(
      sidebarUpgradeReason({ ...base, signals: { hiddenClicks: 0, workDomain: "acme.com" } }),
    ).toEqual({ source: "sidebar_domain", label: "Use links.acme.com" });
  });

  test("falls back to the generic button, skipping signal reasons until they arrive", () => {
    expect(sidebarUpgradeReason(base)).toEqual({ source: "sidebar_free", label: "Upgrade to Pro" });
    expect(sidebarUpgradeReason({ ...base, linksAtLimit: true, signals: null }).source).toBe(
      "sidebar_free_at_limit",
    );
    expect(
      sidebarUpgradeReason({ ...base, events: undefined, qrCodes: undefined, signals: null })
        .source,
    ).toBe("sidebar_free");
  });
});
