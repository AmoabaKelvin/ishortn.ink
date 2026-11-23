import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { TRPCError } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";

import { env } from "@/env.mjs";
import { resolveLink } from "@/middlewares/record-click";
import { abuseRouter } from "@/server/api/routers/abuse/abuse.procedure";
import { deleteDomainAndAssociatedLinks } from "@/server/api/routers/domains/domains.service";
import {
  checkAliasAvailability as previewAliasAvailability,
  deleteLink,
  updateLink,
} from "@/server/api/routers/link/link.service";
import { checkAliasAvailability } from "@/server/api/routers/link/utils";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { stubCloudflareContext } from "../../../test/cloudflare-context";
import { isPreviousAddressOf } from "./link-address";
import { isAliasReserved } from "./reserved-alias";

import type { TRPCContext, WorkspaceTRPCContext } from "@/server/api/trpc";

describe("isPreviousAddressOf", () => {
  const moved = { domain: "ishortn.ink", alias: "Launch" };

  test("is false for the link's current address, in any case", () => {
    expect(isPreviousAddressOf(moved, "ishortn.ink", "launch")).toBe(false);
    expect(isPreviousAddressOf(moved, "ISHORTN.INK", "LAUNCH")).toBe(false);
  });

  test("is true for another domain or alias", () => {
    expect(isPreviousAddressOf(moved, "isht.ink", "launch")).toBe(true);
    expect(isPreviousAddressOf(moved, "ishortn.ink", "launch-old")).toBe(true);
  });
});

// Runs against a disposable MySQL with the schema pushed; see CONTRIBUTING.md,
// "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("moving a link to another domain (MySQL)", () => {
  const OWNER = "link_address_owner";
  const OTHER = "link_address_other";
  const USERS = [OWNER, OTHER];
  const CUSTOM_DOMAIN = "go.link-address.test";
  // 30 characters: longer than the 20 the previous-address table once held.
  const LONG_ALIAS = "move-me-with-a-long-alias-0030";
  const ALIASES = ["move-me", "move-taken", "move-renamed", LONG_ALIAS];

  function workspaceCtx(userId: string): WorkspaceTRPCContext {
    // SAFETY: updateLink and deleteLink read only db, auth.userId, restrictedAt
    // and the personal workspace fields set here.
    return {
      db,
      auth: { userId },
      restrictedAt: null,
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

  async function insertLink(alias: string, domain: string, userId = OWNER) {
    const [result] = await db
      .insert(schema.link)
      .values({ url: "https://example.com/destination", alias, domain, userId });
    return Number(result.insertId);
  }

  async function updateError(input: Parameters<typeof updateLink>[1]) {
    try {
      await updateLink(workspaceCtx(OWNER), input);
    } catch (error) {
      return error;
    }
    throw new Error("expected updateLink to fail");
  }

  async function cleanup() {
    const links = await db
      .select({ id: schema.link.id })
      .from(schema.link)
      .where(inArray(schema.link.userId, USERS));
    await db
      .delete(schema.linkPreviousAddress)
      .where(inArray(schema.linkPreviousAddress.alias, ALIASES));
    if (links.length > 0) {
      await db.delete(schema.flaggedLink).where(
        inArray(
          schema.flaggedLink.linkId,
          links.map((l) => l.id),
        ),
      );
      await db.delete(schema.linkPreviousAddress).where(
        inArray(
          schema.linkPreviousAddress.linkId,
          links.map((l) => l.id),
        ),
      );
    }
    await db.delete(schema.reservedAlias).where(inArray(schema.reservedAlias.alias, ALIASES));
    await db.delete(schema.customDomain).where(inArray(schema.customDomain.userId, USERS));
    await db.delete(schema.link).where(inArray(schema.link.userId, USERS));
    await db.delete(schema.user).where(inArray(schema.user.id, USERS));
  }

  // An in-memory KV, so the lookups below also exercise the link cache.
  let restoreCloudflareContext: () => void;

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
    restoreCloudflareContext = stubCloudflareContext();
  });

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values([
      { id: OWNER, email: "owner@link-address.test" },
      { id: OTHER, email: "other@link-address.test" },
    ]);
  });

  afterAll(async () => {
    await cleanup();
    restoreCloudflareContext();
  });

  test("the link moves and its old short URL resolves to the same link", async () => {
    const id = await insertLink("move-me", "isht.ink");
    await updateLink(workspaceCtx(OWNER), { id, domain: "ishortn.ink", alias: "move-me" });

    const moved = await db.query.link.findFirst({ where: eq(schema.link.id, id) });
    expect(moved?.domain).toBe("ishortn.ink");

    // Both addresses resolve to the same row, so clicks on either count for it.
    expect((await resolveLink("ishortn.ink", "move-me"))?.id).toBe(id);
    const viaOld = await resolveLink("isht.ink", "MOVE-ME");
    expect(viaOld?.id).toBe(id);
    expect(viaOld?.url).toBe("https://example.com/destination");

    // Destination edits apply to the old address too, though it is now cached.
    await updateLink(workspaceCtx(OWNER), { id, url: "https://example.com/updated" });
    expect((await resolveLink("isht.ink", "move-me"))?.url).toBe("https://example.com/updated");
  });

  test("a moved link's old address keeps an alias longer than 20 characters in full", async () => {
    expect(LONG_ALIAS).toHaveLength(30);
    const id = await insertLink(LONG_ALIAS, "isht.ink");
    await updateLink(workspaceCtx(OWNER), { id, domain: "ishortn.ink" });

    const previous = await db
      .select({ alias: schema.linkPreviousAddress.alias })
      .from(schema.linkPreviousAddress)
      .where(eq(schema.linkPreviousAddress.linkId, id));
    expect(previous).toEqual([{ alias: LONG_ALIAS }]);
    expect((await resolveLink("isht.ink", LONG_ALIAS))?.id).toBe(id);
  });

  test("the old address stays reserved, also after the link is deleted", async () => {
    const id = await insertLink("move-me", CUSTOM_DOMAIN);
    await updateLink(workspaceCtx(OWNER), { id, domain: "isht.app" });

    expect(await isAliasReserved(db, "move-me", CUSTOM_DOMAIN)).toBe(true);
    const error = await checkAliasAvailability({ db }, "move-me", CUSTOM_DOMAIN).catch((e) => e);
    expect(error instanceof TRPCError && error.code).toBe("CONFLICT");

    await deleteLink(workspaceCtx(OWNER), { id });
    expect(await resolveLink(CUSTOM_DOMAIN, "move-me")).toBeNull();
    expect(await isAliasReserved(db, "move-me", CUSTOM_DOMAIN)).toBe(true);
  });

  test("moving onto a domain where the alias is taken fails with a clear error", async () => {
    await insertLink("move-taken", "ishortn.ink", OTHER);
    const id = await insertLink("move-taken", "isht.ink");

    const error = await updateError({ id, domain: "ishortn.ink" });
    expect(error instanceof TRPCError && error.code).toBe("CONFLICT");
    expect(error instanceof TRPCError && error.message).toBe(
      '"move-taken" is already taken on ishortn.ink. Choose a different alias or domain.',
    );

    const unchanged = await db.query.link.findFirst({ where: eq(schema.link.id, id) });
    expect(unchanged?.domain).toBe("isht.ink");
    expect(await resolveLink("isht.ink", "move-taken")).not.toBeNull();
  });

  test("another link can't claim a moved link's old address", async () => {
    const movedId = await insertLink("move-me", "isht.ink");
    await updateLink(workspaceCtx(OWNER), { id: movedId, domain: "ishortn.ink" });
    const id = await insertLink("move-me", "isht.app");

    const error = await updateError({ id, domain: "isht.ink" });
    expect(error instanceof TRPCError && error.code).toBe("CONFLICT");
    expect((await resolveLink("isht.ink", "move-me"))?.id).toBe(movedId);
  });

  test("a link can move back to its own old address", async () => {
    const id = await insertLink("move-me", "isht.ink");
    await updateLink(workspaceCtx(OWNER), { id, domain: "ishortn.ink" });
    await updateLink(workspaceCtx(OWNER), { id, domain: "isht.ink" });

    const back = await db.query.link.findFirst({ where: eq(schema.link.id, id) });
    expect(back?.domain).toBe("isht.ink");
    const previous = await db
      .select()
      .from(schema.linkPreviousAddress)
      .where(eq(schema.linkPreviousAddress.linkId, id));
    expect(previous.map((row) => `${row.domain}/${row.alias}`)).toEqual(["ishortn.ink/move-me"]);
  });

  test("moving and renaming at once keeps the old address redirecting", async () => {
    const id = await insertLink("move-me", "isht.ink");
    await updateLink(workspaceCtx(OWNER), { id, domain: "ishortn.ink", alias: "move-renamed" });

    expect((await resolveLink("ishortn.ink", "move-renamed"))?.id).toBe(id);
    expect((await resolveLink("isht.ink", "move-me"))?.id).toBe(id);
  });

  test("removing the old domain frees its previous addresses for the next owner", async () => {
    const [domain] = await db
      .insert(schema.customDomain)
      .values({ userId: OWNER, domain: CUSTOM_DOMAIN, status: "active" });
    const id = await insertLink("move-me", CUSTOM_DOMAIN);
    await updateLink(workspaceCtx(OWNER), { id, domain: "ishortn.ink" });
    expect((await resolveLink(CUSTOM_DOMAIN, "move-me"))?.id).toBe(id);

    await deleteDomainAndAssociatedLinks(workspaceCtx(OWNER), Number(domain.insertId), {
      removeHostname: async () => {},
    });

    // The link itself lives on, but the removed hostname no longer answers for it
    // (cache included) and the alias is open to whoever adds the domain next.
    expect((await resolveLink("ishortn.ink", "move-me"))?.id).toBe(id);
    expect(await resolveLink(CUSTOM_DOMAIN, "move-me")).toBeNull();
    expect(await isAliasReserved(db, "move-me", CUSTOM_DOMAIN)).toBe(false);
  });

  test("a moved link's old short URL can still be reported for abuse", async () => {
    const id = await insertLink("move-me", "isht.ink");
    await updateLink(workspaceCtx(OWNER), { id, domain: "ishortn.ink" });

    // SAFETY: the report procedure reads only ctx.db.
    const caller = abuseRouter.createCaller({ db } as TRPCContext);
    await caller.report({ shortUrl: "https://isht.ink/Move-Me", category: "phishing" });

    const flags = await db
      .select({ linkId: schema.flaggedLink.linkId })
      .from(schema.flaggedLink)
      .where(eq(schema.flaggedLink.linkId, id));
    expect(flags).toEqual([{ linkId: id }]);
  });

  test("the create-page alias preview matches the alias check create uses", async () => {
    const id = await insertLink("move-me", "isht.ink");
    await updateLink(workspaceCtx(OWNER), { id, domain: "ishortn.ink" });

    // Taken in another case, and kept by a moved link.
    const preview = (alias: string, domain: string) =>
      previewAliasAvailability({ db, headers: new Headers() }, { alias, domain });
    expect(await preview("MOVE-ME", "ishortn.ink")).toEqual({ isAvailable: false });
    expect(await preview("move-me", "isht.ink")).toEqual({ isAvailable: false });
    expect(await preview("move-me", "isht.app")).toEqual({ isAvailable: true });
  });
});
