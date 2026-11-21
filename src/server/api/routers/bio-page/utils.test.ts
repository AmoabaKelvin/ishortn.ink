import { describe, expect, test } from "bun:test";

import { bioBlock, bioPage } from "@/server/db/schema";

import {
  assertBioLinkBlockCapacity,
  assertSlugAllowed,
  lockBioLinkBlockCapacity,
  RESERVED_BIO_SLUGS,
  sameBioTheme,
} from "./utils";

import type { db } from "@/server/db";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

describe("reserved bio slugs", () => {
  test("excludes the /p route prefix and core app routes", () => {
    for (const slug of ["p", "api", "trpc", "dashboard", "auth", "admin", "abuse"]) {
      expect(RESERVED_BIO_SLUGS.has(slug)).toBe(true);
    }
  });

  test("assertSlugAllowed rejects reserved handles (case-insensitively)", () => {
    expect(() => assertSlugAllowed("dashboard")).toThrow();
    expect(() => assertSlugAllowed("API")).toThrow();
    expect(() => assertSlugAllowed("Admin")).toThrow();
  });

  test("assertSlugAllowed accepts normal handles", () => {
    expect(() => assertSlugAllowed("janedoe")).not.toThrow();
    expect(() => assertSlugAllowed("my-links")).not.toThrow();
    expect(() => assertSlugAllowed("acme_co")).not.toThrow();
  });
});

describe("bio link block cap", () => {
  test("free pages accept link blocks below the cap", () => {
    expect(() => assertBioLinkBlockCapacity("free", 0)).not.toThrow();
    expect(() => assertBioLinkBlockCapacity("free", 2)).not.toThrow();
  });

  test("free pages reject a 4th link block with an upgrade message", () => {
    expect(() => assertBioLinkBlockCapacity("free", 3)).toThrow(/3 link blocks per bio page/);
    expect(() => assertBioLinkBlockCapacity("free", 10)).toThrow(/Upgrade to Pro/);
  });

  test("paid plans have no link block cap", () => {
    expect(() => assertBioLinkBlockCapacity("pro", 500)).not.toThrow();
    expect(() => assertBioLinkBlockCapacity("ultra", 500)).not.toThrow();
  });
});

// An in-memory bio page with InnoDB's row-lock behaviour: `SELECT ... FOR
// UPDATE` on the page waits until the transaction holding the lock ends, and
// inserted blocks become visible to other transactions only on commit.
function fakePageStore(initialLinkBlocks: number) {
  let committedLinkBlocks = initialLinkBlocks;
  let lockQueue: Promise<void> = Promise.resolve();
  const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

  async function transaction(
    run: (tx: TransactionClient, insertLinkBlock: () => Promise<void>) => Promise<void>,
  ): Promise<void> {
    let release = () => {};
    let pendingInserts = 0;

    const tx = {
      select: () => ({
        from: (table: typeof bioPage | typeof bioBlock) => ({
          where: () => {
            const rows = tick().then(() =>
              table === bioBlock ? [{ count: committedLinkBlocks + pendingInserts }] : [],
            );
            return Object.assign(rows, {
              for: async (mode: "update") => {
                expect(table).toBe(bioPage);
                expect(mode).toBe("update");
                const previous = lockQueue;
                lockQueue = new Promise((resolve) => {
                  release = resolve;
                });
                await previous;
                return [];
              },
            });
          },
        }),
      }),
    };
    const insertLinkBlock = async () => {
      await tick();
      pendingInserts += 1;
    };

    try {
      // SAFETY: lockBioLinkBlockCapacity only calls tx.select().from().where(),
      // awaited directly or through .for("update"), which the fake implements.
      await run(tx as TransactionClient, insertLinkBlock);
      committedLinkBlocks += pendingInserts;
    } finally {
      release();
    }
  }

  return { transaction, linkBlocks: () => committedLinkBlocks };
}

describe("bio link block cap under concurrent adds", () => {
  test("concurrent adds to a free page with 2 link blocks stop at 3", async () => {
    const store = fakePageStore(2);
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        store.transaction(async (tx, insertLinkBlock) => {
          await lockBioLinkBlockCapacity(tx, "free", 1, "user_bio_block_cap_test");
          await insertLinkBlock();
        }),
      ),
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(4);
    expect(store.linkBlocks()).toBe(3);
  });

  test("paid pages have no cap", async () => {
    const store = fakePageStore(500);
    await store.transaction(async (tx, insertLinkBlock) => {
      await lockBioLinkBlockCapacity(tx, "pro", 1, "user_bio_block_cap_test");
      await insertLinkBlock();
    });
    expect(store.linkBlocks()).toBe(501);
  });
});

describe("sameBioTheme", () => {
  test("ignores key order", () => {
    // Keys in the order MySQL may return them, not the order the editor sends.
    const stored = JSON.parse(
      '{"font":"inter","background":{"to":"#000","from":"#fff","type":"gradient"},"accentColor":"#2563eb"}',
    );
    expect(
      sameBioTheme(
        {
          accentColor: "#2563eb",
          background: { type: "gradient", from: "#fff", to: "#000" },
          font: "inter",
        },
        stored,
      ),
    ).toBe(true);
  });

  test("detects changed, added and removed fields", () => {
    const theme = { accentColor: "#2563eb", background: { type: "solid", color: "#fff" } } as const;
    expect(sameBioTheme(theme, { ...theme, accentColor: "#000000" })).toBe(false);
    expect(sameBioTheme(theme, { ...theme, font: "lora" })).toBe(false);
    expect(sameBioTheme(theme, { accentColor: "#2563eb" })).toBe(false);
    expect(sameBioTheme(theme, { ...theme, background: { type: "solid", color: "#000" } })).toBe(
      false,
    );
    expect(sameBioTheme(theme, null)).toBe(false);
  });
});
