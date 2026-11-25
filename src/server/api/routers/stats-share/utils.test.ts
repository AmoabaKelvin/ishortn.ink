import { describe, expect, test } from "bun:test";

import { resolveRangeWindow } from "@/lib/core/analytics";

import {
  buildSharedStats,
  canManageStatsShare,
  canViewSharedStats,
  generateStatsShareToken,
  isStatsShareToken,
  resolveSharedStatsRange,
} from "./utils";

import type { SharedStatsLinkRow } from "./utils";
import type { LinkVisit, UniqueLinkVisit } from "@/server/db/schema";
import type { WorkspaceContext } from "@/server/lib/workspace/types";

const TOKEN = "Ab3_dE-fGh1jKlMnOpQrStUv";

const sharedRow: SharedStatsLinkRow = {
  statsShareToken: TOKEN,
  disabled: false,
  blocked: false,
  flagged: false,
  ownerBanned: false,
  ownerRestrictedAt: null,
  ownerDeletedAt: null,
  teamId: null,
  teamOwnerId: null,
  teamDeletedAt: null,
  teamOwnerBanned: null,
  teamOwnerRestrictedAt: null,
};

describe("share tokens", () => {
  test("are random, URL-safe and at least 22 characters", () => {
    const tokens = new Set(Array.from({ length: 200 }, generateStatsShareToken));
    expect(tokens.size).toBe(200);
    for (const token of tokens) {
      expect(token.length).toBeGreaterThanOrEqual(22);
      expect(isStatsShareToken(token)).toBe(true);
    }
  });

  test("malformed tokens are rejected before any lookup", () => {
    for (const value of ["", "short", "a".repeat(21), `${"a".repeat(22)}/x`, "a b".repeat(10)]) {
      expect(isStatsShareToken(value)).toBe(false);
    }
  });
});

describe("canViewSharedStats", () => {
  test("a shared link with the exact token is shown", () => {
    expect(canViewSharedStats(sharedRow, TOKEN)).toBe(true);
  });

  test("an unknown or revoked token is not", () => {
    expect(canViewSharedStats(undefined, TOKEN)).toBe(false);
    expect(canViewSharedStats({ ...sharedRow, statsShareToken: null }, TOKEN)).toBe(false);
  });

  test("a legacy publicStats link without a token is not reachable", () => {
    const legacy = { ...sharedRow, publicStats: true, statsShareToken: null };
    expect(canViewSharedStats(legacy, "")).toBe(false);
    expect(canViewSharedStats(legacy, TOKEN)).toBe(false);
  });

  test("the token must match exactly, not just case-insensitively", () => {
    expect(canViewSharedStats(sharedRow, TOKEN.toLowerCase())).toBe(false);
    expect(canViewSharedStats(sharedRow, TOKEN.toUpperCase())).toBe(false);
  });

  test("disabled, blocked and flagged links are not shown", () => {
    expect(canViewSharedStats({ ...sharedRow, disabled: true }, TOKEN)).toBe(false);
    expect(canViewSharedStats({ ...sharedRow, blocked: true }, TOKEN)).toBe(false);
    expect(canViewSharedStats({ ...sharedRow, flagged: true }, TOKEN)).toBe(false);
  });

  test("banned, restricted or deleted owners are not shown", () => {
    const at = new Date("2026-11-01T00:00:00Z");
    expect(canViewSharedStats({ ...sharedRow, ownerBanned: true }, TOKEN)).toBe(false);
    expect(canViewSharedStats({ ...sharedRow, ownerRestrictedAt: at }, TOKEN)).toBe(false);
    expect(canViewSharedStats({ ...sharedRow, ownerDeletedAt: at }, TOKEN)).toBe(false);
  });

  test("team links need a live team with an owner in good standing", () => {
    const teamRow = { ...sharedRow, teamId: 7, teamOwnerId: "user_owner" };
    const at = new Date("2026-11-01T00:00:00Z");
    expect(canViewSharedStats(teamRow, TOKEN)).toBe(true);
    expect(canViewSharedStats({ ...teamRow, teamOwnerId: null }, TOKEN)).toBe(false);
    expect(canViewSharedStats({ ...teamRow, teamDeletedAt: at }, TOKEN)).toBe(false);
    expect(canViewSharedStats({ ...teamRow, teamOwnerBanned: true }, TOKEN)).toBe(false);
    expect(canViewSharedStats({ ...teamRow, teamOwnerRestrictedAt: at }, TOKEN)).toBe(false);
  });
});

describe("resolveSharedStatsRange", () => {
  test("Free always sees the last 7 days", () => {
    for (const range of [undefined, "24h", "30d", "all", "custom"]) {
      expect(resolveSharedStatsRange(range, false)).toBe("7d");
    }
  });

  test("paid plans get the presets, never a custom range", () => {
    expect(resolveSharedStatsRange("all", true)).toBe("all");
    expect(resolveSharedStatsRange("last_month", true)).toBe("last_month");
    expect(resolveSharedStatsRange("custom", true)).toBe("7d");
    expect(resolveSharedStatsRange("bogus", true)).toBe("7d");
    expect(resolveSharedStatsRange(undefined, true)).toBe("7d");
  });
});

describe("canManageStatsShare", () => {
  const personal: WorkspaceContext = {
    type: "personal",
    userId: "user_me",
    teamId: null,
    teamSlug: null,
    role: "owner",
    plan: "free",
  };
  // SAFETY: canManageStatsShare reads only type, role and userId.
  const team = (role: "owner" | "admin" | "member") =>
    ({ type: "team", userId: "user_me", teamId: 7, role, plan: "ultra" }) as WorkspaceContext;

  test("personal owners, team admins and the link's creator can manage", () => {
    expect(canManageStatsShare(personal, null)).toBe(true);
    expect(canManageStatsShare(team("owner"), "user_other")).toBe(true);
    expect(canManageStatsShare(team("admin"), "user_other")).toBe(true);
    expect(canManageStatsShare(team("member"), "user_me")).toBe(true);
  });

  test("other team members cannot", () => {
    expect(canManageStatsShare(team("member"), "user_other")).toBe(false);
    expect(canManageStatsShare(team("member"), null)).toBe(false);
  });
});

describe("buildSharedStats", () => {
  const now = new Date("2026-11-24T12:00:00Z");
  const visit = (overrides: Partial<LinkVisit>): LinkVisit => ({
    id: 1,
    linkId: 1,
    device: "mobile",
    browser: "Chrome",
    os: "Android",
    model: "Pixel 9",
    referer: "https://www.instagram.com/p/private-post?token=x",
    country: "GH",
    city: "Accra",
    continent: "AF",
    matchedGeoRuleId: 3,
    visitId: null,
    verifiedAt: now,
    createdAt: new Date("2026-11-23T10:00:00Z"),
    ...overrides,
  });
  const unique: UniqueLinkVisit = {
    id: 1,
    linkId: 1,
    ipHash: "a".repeat(64),
    createdAt: new Date("2026-11-23T10:00:00Z"),
  };

  test("counts archived clicks and exposes only aggregate, allowlisted fields", () => {
    const stats = buildSharedStats(
      [visit({}), visit({ id: 2, referer: null, country: "US", city: "Austin" })],
      [unique],
      [{ date: "2026-11-20", clicks: 5, uniqueClicks: 3 }],
      resolveRangeWindow("7d", now),
    );

    expect(stats.totalClicks).toBe(7);
    expect(stats.uniqueClicks).toBe(4);
    expect(stats.detailedClicks).toBe(2);
    expect(stats.countries).toEqual({ GH: 1, US: 1 });
    expect(stats.devices).toEqual({ Mobile: 2 });
    // Full referrer URLs collapse to their source.
    expect(stats.referrers).toEqual({ instagram: 1 });
    expect(stats.series.find((point) => point.date === "2026-11-20")?.clicks).toBe(5);
    expect(stats.series).toHaveLength(7);

    const serialized = JSON.stringify(stats);
    for (const secret of ["Accra", "Austin", "Pixel 9", "private-post", "ipHash", "verified"]) {
      expect(serialized).not.toContain(secret);
    }
  });
});
