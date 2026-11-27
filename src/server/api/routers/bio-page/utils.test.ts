import { describe, expect, test } from "bun:test";

import { bioBlock, bioPage } from "@/server/db/schema";

import {
  assertBioBlockCapacity,
  assertSlugAllowed,
  buildBreakdown,
  countryLabel,
  deviceLabel,
  lockBioBlockCapacity,
  referrerHostLabel,
  RESERVED_BIO_SLUGS,
  sameBioTheme,
  subscribersToCsv,
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
    expect(() => assertBioBlockCapacity("free", "link", 0)).not.toThrow();
    expect(() => assertBioBlockCapacity("free", "link", 2)).not.toThrow();
  });

  test("free pages reject a 4th link block with an upgrade message", () => {
    expect(() => assertBioBlockCapacity("free", "link", 3)).toThrow(/3 link blocks per bio page/);
    expect(() => assertBioBlockCapacity("free", "link", 10)).toThrow(/Upgrade to Pro/);
  });

  test("paid plans have no link block cap", () => {
    expect(() => assertBioBlockCapacity("pro", "link", 500)).not.toThrow();
    expect(() => assertBioBlockCapacity("ultra", "link", 500)).not.toThrow();
  });
});

describe("bio embed block cap", () => {
  test("free pages accept one embed and reject a second with an upgrade message", () => {
    expect(() => assertBioBlockCapacity("free", "embed", 0)).not.toThrow();
    expect(() => assertBioBlockCapacity("free", "embed", 1)).toThrow(
      "The free plan allows 1 embed block per bio page. Upgrade to Pro for unlimited embeds.",
    );
  });

  test("paid plans have no embed cap", () => {
    expect(() => assertBioBlockCapacity("pro", "embed", 50)).not.toThrow();
    expect(() => assertBioBlockCapacity("ultra", "embed", 50)).not.toThrow();
  });

  test("the caps are separate: a full set of link blocks doesn't block an embed", () => {
    expect(() => assertBioBlockCapacity("free", "link", 3)).toThrow();
    expect(() => assertBioBlockCapacity("free", "embed", 0)).not.toThrow();
  });
});

describe("bio email signup block cap", () => {
  test("free pages accept one signup form and reject a second with an upgrade message", () => {
    expect(() => assertBioBlockCapacity("free", "email_capture", 0)).not.toThrow();
    expect(() => assertBioBlockCapacity("free", "email_capture", 1)).toThrow(
      "The free plan allows 1 email signup block per bio page. Upgrade to Pro for unlimited signup forms.",
    );
  });

  test("paid plans have no signup form cap", () => {
    expect(() => assertBioBlockCapacity("pro", "email_capture", 50)).not.toThrow();
    expect(() => assertBioBlockCapacity("ultra", "email_capture", 50)).not.toThrow();
  });
});

describe("subscribersToCsv", () => {
  test("writes a header and one quoted row per subscriber, in UTC", () => {
    const csv = subscribersToCsv([
      { email: "ana@example.com", createdAt: new Date("2026-11-23T14:05:09.000Z") },
      { email: "bo@example.com", createdAt: new Date("2026-11-01T00:00:00.000Z") },
    ]);
    expect(csv).toBe(
      'Email,Signed up at (UTC)\r\n"ana@example.com","2026-11-23 14:05:09"\r\n"bo@example.com","2026-11-01 00:00:00"\r\n',
    );
  });

  test("neutralises spreadsheet formulas in addresses", () => {
    const csv = subscribersToCsv([{ email: "=cmd@example.com", createdAt: null }]);
    expect(csv.split("\r\n")[1]).toBe(`"'=cmd@example.com",""`);
  });

  test("an empty list is just the header", () => {
    expect(subscribersToCsv([])).toBe("Email,Signed up at (UTC)\r\n");
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
      // SAFETY: lockBioBlockCapacity only calls tx.select().from().where(),
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
          await lockBioBlockCapacity(tx, "free", 1, "user_bio_block_cap_test", "link");
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
      await lockBioBlockCapacity(tx, "pro", 1, "user_bio_block_cap_test", "link");
      await insertLinkBlock();
    });
    expect(store.linkBlocks()).toBe(501);
  });
});

describe("bio embed block cap under concurrent adds", () => {
  test("concurrent embed adds to an empty free page stop at 1", async () => {
    const store = fakePageStore(0);
    const results = await Promise.allSettled(
      Array.from({ length: 3 }, () =>
        store.transaction(async (tx, insertBlock) => {
          await lockBioBlockCapacity(tx, "free", 1, "user_bio_block_cap_test", "embed");
          await insertBlock();
        }),
      ),
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(store.linkBlocks()).toBe(1);
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

describe("breakdowns", () => {
  test("returns nothing for no clicks", () => {
    expect(buildBreakdown([], countryLabel)).toEqual([]);
  });

  test("merges values that share a label", () => {
    expect(
      buildBreakdown(
        [
          { value: null, count: 2 },
          { value: "", count: 1 },
          { value: "Ghana", count: 1 },
        ],
        countryLabel,
      ),
    ).toEqual([
      { name: "Unknown", clicks: 3 },
      { name: "Ghana", clicks: 1 },
    ]);
    expect(
      buildBreakdown(
        [
          { value: "mobile", count: 1 },
          { value: "Mobile", count: 1 },
          { value: null, count: 1 },
        ],
        deviceLabel,
      ),
    ).toEqual([
      { name: "Mobile", clicks: 2 },
      { name: "Unknown", clicks: 1 },
    ]);
    expect(
      buildBreakdown(
        [
          { value: null, count: 1 },
          { value: "", count: 1 },
          { value: "null", count: 1 },
          { value: "direct", count: 1 },
          { value: "https://www.instagram.com/p/abc", count: 1 },
          { value: "https://l.instagram.com/?u=x", count: 1 },
          { value: "instagram.com", count: 1 },
          { value: "twitter", count: 1 },
        ],
        referrerHostLabel,
      ),
    ).toEqual([
      { name: "Direct", clicks: 4 },
      { name: "Instagram", clicks: 3 },
      { name: "X", clicks: 1 },
    ]);
  });

  test("keeps the top ten and folds the rest into Other", () => {
    const rows = Array.from({ length: 13 }, (_, i) => ({ value: `Country ${i}`, count: 20 - i }));
    const breakdown = buildBreakdown(rows, countryLabel);

    expect(breakdown).toHaveLength(11);
    expect(breakdown[0]).toEqual({ name: "Country 0", clicks: 20 });
    expect(breakdown.at(-1)).toEqual({ name: "Other", clicks: 8 + 9 + 10 });
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    expect(breakdown.reduce((sum, r) => sum + r.clicks, 0)).toBe(total);
  });

  test("adds the remainder to a real Other row instead of duplicating it", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ value: `Source ${i}`, count: 20 - i }));
    rows.push({ value: "other", count: 15 });
    const breakdown = buildBreakdown(rows, referrerHostLabel);

    expect(breakdown.filter((r) => r.name === "Other")).toEqual([
      { name: "Other", clicks: 15 + 9 + 10 + 11 },
    ]);
    expect(breakdown).toHaveLength(10);
  });
});
