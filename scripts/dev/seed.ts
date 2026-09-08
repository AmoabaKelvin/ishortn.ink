// bun scripts/dev/seed.ts [--user <clerkUserId>] [--email <email>]
// Idempotent: links upsert by alias, child rows are replaced.

import { createHash, randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import { DEFAULT_PLATFORM_DOMAIN } from "../../src/lib/constants/domains";
import * as schema from "../../src/server/db/schema";

const { user, link, linkVisit, uniqueLinkVisit, folder, tag, linkTag } = schema;

const DEV_USER = {
  id: "user_local_dev_00000000000000000",
  email: "dev+clerk_test@example.com",
  name: "Local Dev",
};
const DOMAIN = DEFAULT_PLATFORM_DOMAIN;
const SEED_PASSWORD = "password";
const DAYS = 14;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function parseArgs(argv: string[]) {
  let user: string | undefined;
  let email: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = argv[i + 1];
    if (arg === "--user" && value) {
      user = value;
      i++;
    } else if (arg === "--email" && value) {
      email = value;
      i++;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }
  return { user, email };
}

// mulberry32, so re-runs produce the same data
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, weighted: [T, number][]): T {
  const total = weighted.reduce((sum, [, w]) => sum + w, 0);
  let r = random() * total;
  for (const [value, w] of weighted) {
    r -= w;
    if (r <= 0) return value;
  }
  return weighted[weighted.length - 1]![0];
}

const GEO: [{ country: string; city: string; continent: string }, number][] = [
  [{ country: "United States", city: "San Francisco", continent: "North America" }, 22],
  [{ country: "United States", city: "New York", continent: "North America" }, 14],
  [{ country: "United Kingdom", city: "London", continent: "Europe" }, 12],
  [{ country: "Germany", city: "Berlin", continent: "Europe" }, 9],
  [{ country: "Ghana", city: "Accra", continent: "Africa" }, 8],
  [{ country: "Nigeria", city: "Lagos", continent: "Africa" }, 7],
  [{ country: "India", city: "Bengaluru", continent: "Asia" }, 10],
  [{ country: "Brazil", city: "Sao Paulo", continent: "South America" }, 5],
  [{ country: "Canada", city: "Toronto", continent: "North America" }, 6],
  [{ country: "Australia", city: "Sydney", continent: "Oceania" }, 4],
  [{ country: "Japan", city: "Tokyo", continent: "Asia" }, 3],
];

const DEVICE: [{ device: string; os: string; browser: string; model: string }, number][] = [
  [{ device: "Desktop", os: "macOS", browser: "Chrome", model: "Macintosh" }, 25],
  [{ device: "Desktop", os: "Windows", browser: "Chrome", model: "Unknown" }, 20],
  [{ device: "Desktop", os: "Windows", browser: "Edge", model: "Unknown" }, 6],
  [{ device: "Desktop", os: "Linux", browser: "Firefox", model: "Unknown" }, 5],
  [{ device: "mobile", os: "iOS", browser: "Mobile Safari", model: "iPhone" }, 24],
  [{ device: "mobile", os: "Android", browser: "Chrome", model: "Pixel 8" }, 12],
  [{ device: "mobile", os: "Android", browser: "Samsung Internet", model: "SM-S928B" }, 5],
  [{ device: "tablet", os: "iOS", browser: "Mobile Safari", model: "iPad" }, 3],
];

const REFERER: [string, number][] = [
  ["direct", 35],
  ["twitter", 18],
  ["google.com", 15],
  ["linkedin", 10],
  ["github.com", 8],
  ["reddit", 6],
  ["facebook", 4],
  ["news.ycombinator.com", 4],
];

type SeedLink = {
  alias: string;
  name: string;
  url: string;
  folder: string | null;
  tags: string[];
  clicksPerDay: number;
  disableLinkAfterDate?: Date;
  passwordHash?: string;
  note?: string;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");

  const connection = await mysql.createConnection(databaseUrl);
  try {
    const db = drizzle(connection);
    const now = new Date();
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

    let userId: string;
    let userEmail: string | null;
    if (args.user) {
      const [row] = await db.select().from(user).where(eq(user.id, args.user)).limit(1);
      if (!row) throw new Error(`No User row with id ${args.user}`);
      userId = row.id;
      userEmail = row.email;
    } else if (args.email) {
      const [row] = await db.select().from(user).where(eq(user.email, args.email)).limit(1);
      if (!row) throw new Error(`No User row with email ${args.email}`);
      userId = row.id;
      userEmail = row.email;
    } else {
      await db
        .insert(user)
        .values({ id: DEV_USER.id, email: DEV_USER.email, name: DEV_USER.name })
        .onDuplicateKeyUpdate({ set: { email: DEV_USER.email, name: DEV_USER.name } });
      userId = DEV_USER.id;
      userEmail = DEV_USER.email;
    }
    // No Subscription row needed: resolvePlan(null) is "free".

    const folderIds = new Map<string, number>();
    for (const [name, description] of [
      ["Marketing", "Campaign and landing page links"],
      ["Engineering", "Docs, repos and changelogs"],
    ] as const) {
      const [existing] = await db
        .select({ id: folder.id })
        .from(folder)
        .where(and(eq(folder.userId, userId), eq(folder.name, name), isNull(folder.teamId)))
        .limit(1);
      if (existing) {
        folderIds.set(name, existing.id);
        continue;
      }
      const [res] = await db.insert(folder).values({ name, description, userId });
      folderIds.set(name, res.insertId);
    }

    const tagIds = new Map<string, number>();
    for (const name of ["seed", "docs", "marketing", "social"]) {
      const [existing] = await db
        .select({ id: tag.id })
        .from(tag)
        .where(and(eq(tag.userId, userId), eq(tag.name, name), isNull(tag.teamId)))
        .limit(1);
      if (existing) {
        tagIds.set(name, existing.id);
        continue;
      }
      const [res] = await db.insert(tag).values({ name, userId });
      tagIds.set(name, res.insertId);
    }

    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
    const seedLinks: SeedLink[] = [
      {
        alias: "seed-docs",
        name: "Product docs",
        url: "https://ishortn.ink/docs",
        folder: "Engineering",
        tags: ["seed", "docs"],
        clicksPerDay: 9,
      },
      {
        alias: "seed-pricing",
        name: "Pricing page",
        url: "https://ishortn.ink/pricing?ref=seed",
        folder: "Marketing",
        tags: ["seed", "marketing"],
        clicksPerDay: 6,
      },
      {
        alias: "seed-blog",
        name: "Launch blog post",
        url: "https://ishortn.ink/blog/introducing-analytics",
        folder: "Marketing",
        tags: ["seed", "marketing", "social"],
        clicksPerDay: 4,
      },
      {
        alias: "seed-github",
        name: "GitHub repository",
        url: "https://github.com/AmoabaKelvin/ishortn.ink",
        folder: "Engineering",
        tags: ["seed", "docs"],
        clicksPerDay: 3,
      },
      {
        alias: "seed-expired",
        name: "Expired promo",
        url: "https://ishortn.ink/pricing?promo=SUMMER",
        folder: "Marketing",
        tags: ["seed"],
        clicksPerDay: 1,
        disableLinkAfterDate: daysAgo(3),
        note: "Auto-expired 3 days ago",
      },
      {
        alias: "seed-password",
        name: "Password protected",
        url: "https://ishortn.ink/changelog",
        folder: null,
        tags: ["seed"],
        clicksPerDay: 1,
        passwordHash,
        note: `Password: ${SEED_PASSWORD}`,
      },
    ];

    await db
      .insert(link)
      .values(
        seedLinks.map((l) => ({
          alias: l.alias,
          domain: DOMAIN,
          name: l.name,
          url: l.url,
          userId,
          createdByUserId: userId,
          folderId: l.folder ? folderIds.get(l.folder) : null,
          disableLinkAfterDate: l.disableLinkAfterDate ?? null,
          passwordHash: l.passwordHash ?? null,
          note: l.note ?? null,
          disabled: false,
          archived: false,
          createdAt: daysAgo(DAYS + 7),
        })),
      )
      .onDuplicateKeyUpdate({
        // VALUES(col) is the incoming row; a bare column ref would be a no-op
        set: {
          name: sql`VALUES(name)`,
          url: sql`VALUES(url)`,
          userId,
          folderId: sql`VALUES(folderId)`,
          disableLinkAfterDate: sql`VALUES(disableLinkAfterDate)`,
          passwordHash: sql`VALUES(passwordHash)`,
          note: sql`VALUES(note)`,
          disabled: false,
          archived: false,
        },
      });

    const aliases = seedLinks.map((l) => l.alias);
    const linkRows = await db
      .select({ id: link.id, alias: link.alias })
      .from(link)
      .where(and(inArray(link.alias, aliases), eq(link.domain, DOMAIN)));
    const linkIdByAlias = new Map(linkRows.map((r) => [r.alias, r.id]));
    const linkIds = linkRows.map((r) => r.id);

    await db.delete(linkTag).where(inArray(linkTag.linkId, linkIds));
    const linkTagRows = seedLinks.flatMap((l) =>
      l.tags.map((t) => ({ linkId: linkIdByAlias.get(l.alias)!, tagId: tagIds.get(t)! })),
    );
    await db.insert(linkTag).values(linkTagRows);

    await db.delete(linkVisit).where(inArray(linkVisit.linkId, linkIds));
    await db.delete(uniqueLinkVisit).where(inArray(uniqueLinkVisit.linkId, linkIds));

    const random = rng(0x5eed);
    const visits: schema.NewLinkVisit[] = [];
    const firstSeen = new Map<string, { linkId: number; ipHash: string; createdAt: Date }>();

    for (const l of seedLinks) {
      const linkId = linkIdByAlias.get(l.alias)!;
      const lastDay = l.disableLinkAfterDate
        ? Math.ceil((now.getTime() - l.disableLinkAfterDate.getTime()) / 86_400_000)
        : 0;
      for (let day = DAYS - 1; day >= lastDay; day--) {
        const dayStart = daysAgo(day);
        const weekend = dayStart.getDay() === 0 || dayStart.getDay() === 6;
        const base = l.clicksPerDay * (weekend ? 0.5 : 1) * (1 + (DAYS - day) / DAYS);
        const count = Math.max(0, Math.round(base * (0.6 + random() * 0.8)));
        for (let i = 0; i < count; i++) {
          const geo = pick(random, GEO);
          const dev = pick(random, DEVICE);
          const referer = pick(random, REFERER);
          const hour = Math.floor(6 + random() * 16);
          const createdAt = new Date(dayStart);
          createdAt.setHours(hour, Math.floor(random() * 60), Math.floor(random() * 60), 0);
          const visitor = Math.floor(random() * 45);
          const ipHash = createHash("sha256").update(`seed-${l.alias}-${visitor}`).digest("hex");

          visits.push({
            linkId,
            ...dev,
            ...geo,
            referer,
            visitId: randomUUID(),
            verifiedAt: random() < 0.3 ? createdAt : null,
            createdAt,
          });
          const key = `${linkId}:${ipHash}`;
          const seen = firstSeen.get(key);
          if (!seen || seen.createdAt > createdAt)
            firstSeen.set(key, { linkId, ipHash, createdAt });
        }
      }
    }

    const CHUNK = 250;
    for (let i = 0; i < visits.length; i += CHUNK) {
      await db.insert(linkVisit).values(visits.slice(i, i + CHUNK));
    }
    const uniques = [...firstSeen.values()];
    for (let i = 0; i < uniques.length; i += CHUNK) {
      await db.insert(uniqueLinkVisit).values(uniques.slice(i, i + CHUNK));
    }

    console.log(`Seeded for user ${userId} (${userEmail ?? "no email"})`);
    console.log(
      `  folders: ${folderIds.size}, tags: ${tagIds.size}, links: ${linkRows.length}, ` +
        `link tags: ${linkTagRows.length}`,
    );
    console.log(
      `  clicks: ${visits.length}, unique visitors: ${uniques.length} (last ${DAYS} days)`,
    );
    console.log(`  ${APP_URL}/seed-docs`);
    console.log(`  ${APP_URL}/seed-password  (password: ${SEED_PASSWORD})`);
  } finally {
    await connection.end();
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error("Seed failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
