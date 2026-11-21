import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import * as schema from "@/server/db/schema";

import { associateTagsWithLink } from "../tag/tag.service";
import { updateLink } from "./link.service";

import type { WorkspaceTRPCContext } from "../../trpc";

// Exercises tag writes against a real MySQL. Set TEST_DATABASE_URL to run
// them; see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("link tags (MySQL)", () => {
  const pool = mysql.createPool({ uri: testDatabaseUrl ?? "", connectionLimit: 5 });
  const db = drizzle(pool, { schema, mode: "default" });

  const USER = "link_tags_test_user";
  const HOOK_TIMEOUT_MS = 30_000;

  let linkId = 0;

  // SAFETY: mirrors what workspaceProcedure resolves for a personal free workspace;
  // the code under test reads only db, auth.userId, restrictedAt and workspace.
  const ctx = {
    db,
    auth: { userId: USER },
    restrictedAt: null,
    workspace: {
      type: "personal",
      userId: USER,
      teamId: null,
      teamSlug: null,
      role: "owner",
      plan: "free",
    },
  } as WorkspaceTRPCContext;

  async function cleanup() {
    const links = await db.query.link.findMany({ where: eq(schema.link.userId, USER) });
    if (links.length) {
      await db.delete(schema.linkTag).where(
        inArray(
          schema.linkTag.linkId,
          links.map((row) => row.id),
        ),
      );
    }
    await db.delete(schema.tag).where(eq(schema.tag.userId, USER));
    await db.delete(schema.link).where(eq(schema.link.userId, USER));
    await db.delete(schema.user).where(eq(schema.user.id, USER));
  }

  async function linkTagNames() {
    const rows = await db
      .select({ name: schema.tag.name })
      .from(schema.linkTag)
      .innerJoin(schema.tag, eq(schema.linkTag.tagId, schema.tag.id))
      .where(eq(schema.linkTag.linkId, linkId));
    return rows.map((row) => row.name).sort();
  }

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values({ id: USER, name: "Tags", email: "tags@acme.test" });
    const [inserted] = await db.insert(schema.link).values({
      url: "https://example.org",
      alias: "link-tags-test",
      domain: "ishortn.ink",
      name: "Before",
      userId: USER,
    });
    linkId = Number(inserted.insertId);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await cleanup();
    await pool.end();
  });

  test("tags that differ only in case are stored once", async () => {
    await associateTagsWithLink(ctx, linkId, ["Marketing", "marketing", " MARKETING ", "Sales"]);

    expect(await linkTagNames()).toEqual(["marketing", "sales"]);
    const tags = await db.query.tag.findMany({ where: eq(schema.tag.userId, USER) });
    expect(tags.map((row) => row.name).sort()).toEqual(["marketing", "sales"]);
  });

  test("adding an existing tag in a different case keeps the existing tags", async () => {
    await associateTagsWithLink(ctx, linkId, ["marketing"]);
    await associateTagsWithLink(ctx, linkId, ["marketing", "Marketing", "Q4"]);

    expect(await linkTagNames()).toEqual(["marketing", "q4"]);
    const tags = await db.query.tag.findMany({ where: eq(schema.tag.userId, USER) });
    expect(tags).toHaveLength(2);
  });

  test("a failed save leaves the link and its previous tags intact", async () => {
    await associateTagsWithLink(ctx, linkId, ["marketing", "sales"]);

    // Tag names are varchar(50); the over-long one fails after the link row
    // was updated and the old tags were deleted inside the transaction.
    await expect(
      updateLink(ctx, { id: linkId, name: "After", tags: ["new-tag", "x".repeat(60)] }),
    ).rejects.toThrow();

    expect(await linkTagNames()).toEqual(["marketing", "sales"]);
    const row = await db.query.link.findFirst({ where: eq(schema.link.id, linkId) });
    expect(row?.name).toBe("Before");
    const tags = await db.query.tag.findMany({ where: eq(schema.tag.userId, USER) });
    expect(tags.map((t) => t.name).sort()).toEqual(["marketing", "sales"]);
  });
});
