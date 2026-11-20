import { describe, expect, test } from "bun:test";

import {
  inviteEmailMatches,
  inviteStatus,
  inviteView,
  memberRoleChangeError,
  normalizeInviteEmail,
} from "./utils";

const NOW = new Date("2026-11-20T12:00:00Z");
const LATER = new Date("2026-11-27T12:00:00Z");
const EARLIER = new Date("2026-11-19T12:00:00Z");

function invite(overrides: Partial<Parameters<typeof inviteStatus>[0]> = {}) {
  return { email: null, acceptedAt: null, declinedAt: null, expiresAt: LATER, ...overrides };
}

describe("memberRoleChangeError", () => {
  test("lets the owner promote and demote", () => {
    expect(memberRoleChangeError("owner", "member", "admin")).toBeNull();
    expect(memberRoleChangeError("owner", "admin", "member")).toBeNull();
  });

  test("stops an admin from demoting another admin", () => {
    expect(memberRoleChangeError("admin", "admin", "member")).toBe(
      "Only the team owner can change an admin's role",
    );
  });

  test("stops an admin from promoting a member", () => {
    expect(memberRoleChangeError("admin", "member", "admin")).toBe(
      "Only the team owner can promote members to admin",
    );
  });

  test("lets an admin set a member's role to member", () => {
    expect(memberRoleChangeError("admin", "member", "member")).toBeNull();
  });

  test("never changes the owner's role", () => {
    expect(memberRoleChangeError("owner", "owner", "member")).toContain("transfer ownership");
    expect(memberRoleChangeError("admin", "owner", "member")).toContain("transfer ownership");
  });
});

describe("invite emails", () => {
  test("normalises case and surrounding whitespace", () => {
    expect(normalizeInviteEmail("  John@Acme.com ")).toBe("john@acme.com");
  });

  test("matches regardless of case on either side", () => {
    expect(inviteEmailMatches("John@Acme.com", "john@acme.com")).toBe(true);
    expect(inviteEmailMatches("john@acme.com", "JOHN@ACME.COM")).toBe(true);
    expect(inviteEmailMatches("john@acme.com", "jane@acme.com")).toBe(false);
    expect(inviteEmailMatches("john@acme.com", null)).toBe(false);
  });
});

describe("inviteStatus", () => {
  test("orders accepted, declined, expired, pending", () => {
    expect(inviteStatus(invite(), NOW)).toBe("pending");
    expect(inviteStatus(invite({ expiresAt: EARLIER }), NOW)).toBe("expired");
    expect(inviteStatus(invite({ declinedAt: NOW, expiresAt: EARLIER }), NOW)).toBe("declined");
    expect(inviteStatus(invite({ acceptedAt: NOW, expiresAt: EARLIER }), NOW)).toBe("accepted");
  });
});

describe("inviteView", () => {
  test("a used link invite tells non-members it was used, not that they're a member", () => {
    expect(inviteView(invite({ acceptedAt: NOW }), false, NOW)).toBe("used");
  });

  test("an expired or declined link invite gets the same used-or-expired message", () => {
    expect(inviteView(invite({ expiresAt: EARLIER }), false, NOW)).toBe("used");
    expect(inviteView(invite({ declinedAt: NOW }), false, NOW)).toBe("used");
  });

  test("shows 'member' only when the viewer is a member", () => {
    expect(inviteView(invite({ acceptedAt: NOW }), true, NOW)).toBe("member");
    expect(inviteView(invite(), true, NOW)).toBe("member");
  });

  test("email invites keep their own expired and declined states", () => {
    const email = "john@acme.com";
    expect(inviteView(invite({ email }), false, NOW)).toBe("pending");
    expect(inviteView(invite({ email, expiresAt: EARLIER }), false, NOW)).toBe("expired");
    expect(inviteView(invite({ email, declinedAt: NOW }), false, NOW)).toBe("declined");
    expect(inviteView(invite({ email, acceptedAt: NOW }), false, NOW)).toBe("used");
  });
});
