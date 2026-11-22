import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import { TRPCError } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import { DEFAULT_PLATFORM_DOMAIN } from "@/lib/constants/domains";
import { ACCOUNT_RESTRICTED_MESSAGE } from "@/lib/constants/moderation";
import * as schema from "@/server/db/schema";

import { approveHeldDomain, getHeldDomains, rejectHeldDomain } from "../admin/admin.service";
import { cleanupExpiredData } from "../cleanup/expired-data-cleanup.service";
import { shortenLinkWithAutoAlias } from "../link/link.service";
import { assertDomainOwned } from "../link/utils";
import {
  checkDomainStatus,
  deleteDomainAndAssociatedLinks,
  getCustomDomainsForUser,
  getDomainsNeedingMigration,
} from "./domains.service";

import type { ProtectedTRPCContext, WorkspaceTRPCContext } from "../../trpc";
import type { CloudflareCustomHostname } from "./cloudflare";
import type { TeamRole } from "@/server/db/schema";

// Exercises the services against a real MySQL. Set TEST_DATABASE_URL to run
// them; see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("domains service (MySQL)", () => {
  const pool = mysql.createPool({ uri: testDatabaseUrl ?? "", connectionLimit: 5 });
  const db = drizzle(pool, { schema, mode: "default" });

  const OWNER = "domains_test_owner";
  const ADMIN = "domains_test_admin";
  const STRANGER = "domains_test_stranger";
  const USERS = [OWNER, ADMIN, STRANGER];
  const TEAM_SLUG = "domains-service-test";
  const DOMAIN = "links.acme-test.co.uk";
  const TEAM_DOMAIN = "go.acme-test.co.uk";
  const FOREIGN_DOMAIN = "links.stranger-test.com";
  const HOOK_TIMEOUT_MS = 30_000;

  let teamId = 0;

  async function cleanup() {
    const existing = await db.query.team.findFirst({ where: eq(schema.team.slug, TEAM_SLUG) });
    if (existing) {
      await db.delete(schema.teamMember).where(eq(schema.teamMember.teamId, existing.id));
      await db.delete(schema.team).where(eq(schema.team.id, existing.id));
    }
    await db.delete(schema.link).where(inArray(schema.link.userId, USERS));
    await db.delete(schema.bioPage).where(inArray(schema.bioPage.userId, USERS));
    await db.delete(schema.siteSettings).where(inArray(schema.siteSettings.userId, USERS));
    await db.delete(schema.customDomain).where(inArray(schema.customDomain.userId, USERS));
    await db.delete(schema.user).where(inArray(schema.user.id, USERS));
  }

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values([
      { id: OWNER, name: "Owner", email: "owner@domains.test" },
      { id: ADMIN, name: "Admin", email: "admin@domains.test" },
      { id: STRANGER, name: "Stranger", email: "stranger@domains.test" },
    ]);
    const [inserted] = await db
      .insert(schema.team)
      .values({ name: "Acme", slug: TEAM_SLUG, ownerId: OWNER, defaultDomain: TEAM_DOMAIN });
    teamId = Number(inserted.insertId);
    await db.insert(schema.teamMember).values([
      { teamId, userId: OWNER, role: "owner" },
      { teamId, userId: ADMIN, role: "admin" },
    ]);
    await db.insert(schema.customDomain).values([
      { userId: OWNER, domain: DOMAIN, status: "active" },
      { userId: OWNER, teamId, domain: TEAM_DOMAIN, status: "active" },
      { userId: STRANGER, domain: FOREIGN_DOMAIN, status: "active" },
    ]);
    await db.insert(schema.siteSettings).values([
      { userId: OWNER, defaultDomain: DOMAIN },
      { userId: STRANGER, defaultDomain: FOREIGN_DOMAIN },
    ]);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await cleanup();
    await pool.end();
  });

  function personalCtx(userId: string) {
    // SAFETY: mirrors what workspaceProcedure resolves for a personal workspace.
    return {
      db,
      auth: { userId },
      workspace: {
        type: "personal",
        userId,
        teamId: null,
        teamSlug: null,
        role: "owner",
        plan: "pro",
      },
    } as WorkspaceTRPCContext;
  }

  async function teamCtx(userId: string, role: TeamRole) {
    const teamRow = await db.query.team.findFirst({ where: eq(schema.team.id, teamId) });
    const membership = await db.query.teamMember.findFirst({
      where: eq(schema.teamMember.userId, userId),
    });
    if (!teamRow || !membership) throw new Error("test team not seeded");
    // SAFETY: mirrors what workspaceProcedure resolves for a member of the test team.
    return {
      db,
      auth: { userId },
      workspace: {
        type: "team",
        userId,
        teamId,
        teamSlug: TEAM_SLUG,
        team: teamRow,
        membership,
        role,
        plan: "ultra",
      },
    } as WorkspaceTRPCContext;
  }

  async function domainId(domain: string) {
    const row = await db.query.customDomain.findFirst({
      where: eq(schema.customDomain.domain, domain),
    });
    if (!row) throw new Error(`${domain} not seeded`);
    return row.id;
  }

  async function errorCode(promise: Promise<unknown>) {
    try {
      await promise;
    } catch (error) {
      return error instanceof TRPCError ? error.code : String(error);
    }
    return null;
  }

  const removedHostnames: string[] = [];
  const removeHostname = async (domain: string) => {
    removedHostnames.push(domain);
  };

  test("deleting a personal domain resets the default, frees the bio page and removes its links", async () => {
    await db
      .insert(schema.link)
      .values({ url: "https://a.test", alias: "dt1", domain: DOMAIN, userId: OWNER });
    await db
      .insert(schema.bioPage)
      .values({ userId: OWNER, slug: "domains-test-bio", customDomain: DOMAIN });

    await deleteDomainAndAssociatedLinks(personalCtx(OWNER), await domainId(DOMAIN), {
      removeHostname,
    });

    const settings = await db.query.siteSettings.findFirst({
      where: eq(schema.siteSettings.userId, OWNER),
    });
    const bio = await db.query.bioPage.findFirst({ where: eq(schema.bioPage.userId, OWNER) });
    const links = await db.query.link.findMany({ where: eq(schema.link.domain, DOMAIN) });
    const teamRow = await db.query.team.findFirst({ where: eq(schema.team.id, teamId) });

    expect(settings?.defaultDomain).toBe(DEFAULT_PLATFORM_DOMAIN);
    expect(bio?.customDomain).toBeNull();
    expect(links).toHaveLength(0);
    expect(removedHostnames).toContain(DOMAIN);
    // Other workspaces keep their own defaults
    expect(teamRow?.defaultDomain).toBe(TEAM_DOMAIN);
  });

  test("deleting a team domain resets the team default", async () => {
    await deleteDomainAndAssociatedLinks(
      await teamCtx(OWNER, "owner"),
      await domainId(TEAM_DOMAIN),
      {
        removeHostname,
      },
    );

    const teamRow = await db.query.team.findFirst({ where: eq(schema.team.id, teamId) });
    const settings = await db.query.siteSettings.findFirst({
      where: eq(schema.siteSettings.userId, OWNER),
    });
    expect(teamRow?.defaultDomain).toBe(DEFAULT_PLATFORM_DOMAIN);
    expect(settings?.defaultDomain).toBe(DOMAIN);
  });

  test("team admins can't delete domains", async () => {
    expect(
      await errorCode(
        deleteDomainAndAssociatedLinks(await teamCtx(ADMIN, "admin"), await domainId(TEAM_DOMAIN), {
          removeHostname,
        }),
      ),
    ).toBe("FORBIDDEN");
  });

  test("quick shorten refuses a default domain that was deleted", async () => {
    await db.delete(schema.customDomain).where(eq(schema.customDomain.domain, DOMAIN));

    expect(
      await errorCode(shortenLinkWithAutoAlias(personalCtx(OWNER), { url: "https://a.test" })),
    ).toBe("FORBIDDEN");
  });

  test("quick shorten refuses a default domain from another workspace", async () => {
    await db
      .update(schema.siteSettings)
      .set({ defaultDomain: FOREIGN_DOMAIN })
      .where(eq(schema.siteSettings.userId, OWNER));

    expect(
      await errorCode(shortenLinkWithAutoAlias(personalCtx(OWNER), { url: "https://a.test" })),
    ).toBe("FORBIDDEN");
  });

  test("checkStatus rejects domains outside the workspace", async () => {
    expect(await errorCode(checkDomainStatus(personalCtx(OWNER), FOREIGN_DOMAIN))).toBe(
      "NOT_FOUND",
    );
    expect(await errorCode(checkDomainStatus(await teamCtx(OWNER, "owner"), DOMAIN))).toBe(
      "NOT_FOUND",
    );
  });

  describe("checkStatus for a moderated owner", () => {
    const lookups: string[] = [];
    const liveHostname = async (hostname: string): Promise<CloudflareCustomHostname> => {
      lookups.push(hostname);
      return { id: "id", hostname, status: "active", ssl: { status: "active" } };
    };

    async function domainStatus(domain: string) {
      const row = await db.query.customDomain.findFirst({
        where: eq(schema.customDomain.domain, domain),
      });
      return row?.status;
    }

    beforeEach(async () => {
      lookups.length = 0;
      await db
        .update(schema.customDomain)
        .set({ status: "pending" })
        .where(inArray(schema.customDomain.domain, [DOMAIN, TEAM_DOMAIN]));
    });

    test("leaves a restricted owner's domain pending without asking Cloudflare", async () => {
      await db
        .update(schema.user)
        .set({ restrictedAt: new Date(), restrictedReason: "test" })
        .where(eq(schema.user.id, OWNER));

      const result = await checkDomainStatus(personalCtx(OWNER), DOMAIN, {
        lookupHostname: liveHostname,
      });

      expect(result).toEqual({ status: "pending", message: ACCOUNT_RESTRICTED_MESSAGE });
      expect(await domainStatus(DOMAIN)).toBe("pending");
      expect(lookups).toEqual([]);
    });

    test("leaves a banned owner's domain pending without asking Cloudflare", async () => {
      await db.update(schema.user).set({ banned: true }).where(eq(schema.user.id, OWNER));

      const result = await checkDomainStatus(personalCtx(OWNER), DOMAIN, {
        lookupHostname: liveHostname,
      });

      expect(result.status).toBe("pending");
      expect(await domainStatus(DOMAIN)).toBe("pending");
      expect(lookups).toEqual([]);
    });

    test("keeps a restricted team owner's domain pending when a teammate checks it", async () => {
      await db
        .update(schema.user)
        .set({ restrictedAt: new Date(), restrictedReason: "test" })
        .where(eq(schema.user.id, OWNER));

      await checkDomainStatus(await teamCtx(ADMIN, "admin"), TEAM_DOMAIN, {
        lookupHostname: liveHostname,
      });

      expect(await domainStatus(TEAM_DOMAIN)).toBe("pending");
      expect(lookups).toEqual([]);
    });

    test("keeps a team domain pending when the restricted member who added it checks it", async () => {
      const MEMBER_DOMAIN = "member.acme-test.co.uk";
      await db
        .insert(schema.customDomain)
        .values({ userId: ADMIN, teamId, domain: MEMBER_DOMAIN, status: "pending" });
      await db
        .update(schema.user)
        .set({ restrictedAt: new Date(), restrictedReason: "test" })
        .where(eq(schema.user.id, ADMIN));

      const result = await checkDomainStatus(await teamCtx(ADMIN, "admin"), MEMBER_DOMAIN, {
        lookupHostname: liveHostname,
      });

      expect(result).toEqual({ status: "pending", message: ACCOUNT_RESTRICTED_MESSAGE });
      expect(await domainStatus(MEMBER_DOMAIN)).toBe("pending");
      expect(lookups).toEqual([]);
    });

    test("still activates a domain whose owner is in good standing", async () => {
      const result = await checkDomainStatus(personalCtx(OWNER), DOMAIN, {
        lookupHostname: liveHostname,
      });

      expect(result).toEqual({ status: "active" });
      expect(await domainStatus(DOMAIN)).toBe("active");
      expect(lookups).toEqual([DOMAIN]);
    });
  });

  describe("review hold", () => {
    const HELD_DOMAIN = "login.acmme-test.co.uk";

    const activeHostname = async (hostname: string): Promise<CloudflareCustomHostname> => ({
      id: "id",
      hostname,
      status: "active",
      ssl: { status: "active" },
    });
    const pendingHostname = async (hostname: string): Promise<CloudflareCustomHostname> => ({
      id: "id",
      hostname,
      status: "pending",
      ssl: { status: "pending_validation" },
    });

    function adminCtx() {
      // SAFETY: adminProcedure only adds the admin check on top of the protected context.
      return { db, auth: { userId: ADMIN } } as ProtectedTRPCContext;
    }

    async function heldRow() {
      const row = await db.query.customDomain.findFirst({
        where: eq(schema.customDomain.domain, HELD_DOMAIN),
      });
      if (!row) throw new Error("held domain not seeded");
      return row;
    }

    beforeEach(async () => {
      await db.insert(schema.customDomain).values({
        userId: OWNER,
        domain: HELD_DOMAIN,
        status: "pending",
        reviewStatus: "held",
        reviewReason: "Account 1 day old; domain registered 21 days ago",
        registrableDomainRegisteredAt: new Date("2026-11-01T00:00:00Z"),
        registrar: "NameCheap, Inc.",
      });
    });

    test("a held domain stays inactive after DNS verification passes", async () => {
      const result = await checkDomainStatus(personalCtx(OWNER), HELD_DOMAIN, {
        lookupHostname: activeHostname,
      });

      expect(result.status).toBe("in_review");
      expect((await heldRow()).status).toBe("pending");
      // The guard every link, QR code and bio page write uses refuses it
      expect(await errorCode(assertDomainOwned(personalCtx(OWNER), HELD_DOMAIN))).toBe("FORBIDDEN");
    });

    test("the owner sees that it's in review, not why", async () => {
      const domains = await getCustomDomainsForUser(personalCtx(OWNER));
      const held = domains.find((d) => d.domain === HELD_DOMAIN);

      expect(held?.review).toBe("in_review");
      expect(held).not.toHaveProperty("reviewReason");
      expect(held).not.toHaveProperty("registrar");
      expect(domains.find((d) => d.domain === DOMAIN)?.review).toBeNull();
    });

    test("admins see held domains with owner and registration details", async () => {
      const held = (await getHeldDomains(adminCtx())).filter((d) => d.domain === HELD_DOMAIN);

      expect(held).toHaveLength(1);
      expect(held[0]).toMatchObject({
        domain: HELD_DOMAIN,
        ownerEmail: "owner@domains.test",
        plan: "free",
        registrar: "NameCheap, Inc.",
        registeredAt: new Date("2026-11-01T00:00:00Z"),
      });
    });

    test("approving activates a domain whose DNS is already verified", async () => {
      const { id } = await heldRow();
      const result = await approveHeldDomain(
        adminCtx(),
        { id },
        { lookupHostname: activeHostname },
      );

      const row = await heldRow();
      expect(result.status).toBe("active");
      expect(row.status).toBe("active");
      expect(row.reviewStatus).toBe("approved");
      expect(row.reviewedAt).not.toBeNull();
      expect((await getHeldDomains(adminCtx())).map((d) => d.id)).not.toContain(id);
    });

    test("approving a domain without DNS yet leaves it to normal verification", async () => {
      const { id } = await heldRow();
      await approveHeldDomain(adminCtx(), { id }, { lookupHostname: pendingHostname });
      expect((await heldRow()).status).toBe("pending");

      const result = await checkDomainStatus(personalCtx(OWNER), HELD_DOMAIN, {
        lookupHostname: activeHostname,
      });
      expect(result.status).toBe("active");
      expect((await heldRow()).status).toBe("active");
    });

    test("rejecting marks the domain invalid, keeps the reason and releases the hostname", async () => {
      const { id } = await heldRow();
      const released: string[] = [];
      const result = await rejectHeldDomain(
        adminCtx(),
        { id, reason: "Lookalike of a bank" },
        {
          removeHostname: async (domain) => {
            released.push(domain);
          },
        },
      );

      const row = await heldRow();
      expect(result.hostnameReleased).toBe(true);
      expect(released).toEqual([HELD_DOMAIN]);
      expect(row.status).toBe("invalid");
      expect(row.reviewStatus).toBe("rejected");
      expect(row.reviewReason).toBe("Lookalike of a bank");
      // A rejected domain can't be revived through a status check
      expect(
        await errorCode(
          checkDomainStatus(personalCtx(OWNER), HELD_DOMAIN, { lookupHostname: activeHostname }),
        ),
      ).toBe("FORBIDDEN");
    });

    test("a rejected domain survives the invalid-domain cleanup and can't be deleted by its owner", async () => {
      const { id } = await heldRow();
      await rejectHeldDomain(adminCtx(), { id, reason: "Lookalike of a bank" }, { removeHostname });
      await db
        .update(schema.customDomain)
        .set({ createdAt: new Date("2026-01-01T00:00:00Z") })
        .where(inArray(schema.customDomain.domain, [HELD_DOMAIN, FOREIGN_DOMAIN]));
      await db
        .update(schema.customDomain)
        .set({ status: "invalid" })
        .where(eq(schema.customDomain.domain, FOREIGN_DOMAIN));

      await cleanupExpiredData();

      const row = await heldRow();
      expect(row.reviewStatus).toBe("rejected");
      expect(row.reviewReason).toBe("Lookalike of a bank");
      // An ordinary invalid domain past retention still goes
      expect(
        await db.query.customDomain.findFirst({
          where: eq(schema.customDomain.domain, FOREIGN_DOMAIN),
        }),
      ).toBeUndefined();

      expect(
        await errorCode(deleteDomainAndAssociatedLinks(personalCtx(OWNER), id, { removeHostname })),
      ).toBe("FORBIDDEN");
      expect((await heldRow()).id).toBe(id);
    });

    test("approving fails if another admin rejected the domain meanwhile", async () => {
      const { id } = await heldRow();
      const code = await errorCode(
        approveHeldDomain(
          adminCtx(),
          { id },
          {
            lookupHostname: async (hostname) => {
              await rejectHeldDomain(adminCtx(), { id, reason: "Lookalike" }, { removeHostname });
              return activeHostname(hostname);
            },
          },
        ),
      );

      const row = await heldRow();
      expect(code).toBe("NOT_FOUND");
      expect(row.reviewStatus).toBe("rejected");
      expect(row.status).toBe("invalid");
    });

    test("only held domains can be approved or rejected", async () => {
      const notHeld = await domainId(DOMAIN);
      expect(
        await errorCode(
          approveHeldDomain(adminCtx(), { id: notHeld }, { lookupHostname: activeHostname }),
        ),
      ).toBe("NOT_FOUND");
      expect(
        await errorCode(
          rejectHeldDomain(adminCtx(), { id: notHeld, reason: "x" }, { removeHostname }),
        ),
      ).toBe("NOT_FOUND");
    });
  });

  describe("migration notice", () => {
    const pendingHostname = async (hostname: string): Promise<CloudflareCustomHostname> => ({
      id: "id",
      hostname,
      status: "pending",
      ssl: { status: "pending_validation" },
    });

    async function setCreatedAt(domain: string, createdAt: Date) {
      await db
        .update(schema.customDomain)
        .set({ createdAt })
        .where(eq(schema.customDomain.domain, domain));
    }

    test("lists only pre-migration domains that aren't serving yet", async () => {
      await setCreatedAt(DOMAIN, new Date("2025-06-01T00:00:00Z"));

      const notice = await getDomainsNeedingMigration(personalCtx(OWNER), {
        lookupHostname: pendingHostname,
      });

      expect(notice.map((entry) => entry.domain)).toEqual([DOMAIN]);
      expect(notice[0]?.records[0]).toMatchObject({ type: "CNAME", name: "links" });
    });

    test("ignores newly added domains", async () => {
      const notice = await getDomainsNeedingMigration(personalCtx(OWNER), {
        lookupHostname: pendingHostname,
      });
      expect(notice).toEqual([]);
    });

    test("stays hidden when the Cloudflare lookup fails", async () => {
      await setCreatedAt(DOMAIN, new Date("2025-06-01T00:00:00Z"));

      const notice = await getDomainsNeedingMigration(personalCtx(OWNER), {
        lookupHostname: async () => {
          throw new Error("Cloudflare unavailable");
        },
      });
      expect(notice).toEqual([]);
    });

    test("is hidden from roles that can't manage domains", async () => {
      await setCreatedAt(TEAM_DOMAIN, new Date("2025-06-01T00:00:00Z"));

      const asAdmin = await getDomainsNeedingMigration(await teamCtx(ADMIN, "admin"), {
        lookupHostname: pendingHostname,
      });
      const asOwner = await getDomainsNeedingMigration(await teamCtx(OWNER, "owner"), {
        lookupHostname: pendingHostname,
      });
      expect(asAdmin).toEqual([]);
      expect(asOwner.map((entry) => entry.domain)).toEqual([TEAM_DOMAIN]);
    });
  });
});
