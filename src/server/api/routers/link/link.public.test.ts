import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";

import { buildCacheKey } from "@/lib/core/cache";

import { linkRouter } from "./link.procedure";
import {
  PASSWORD_ATTEMPT_WINDOW_MS,
  PASSWORD_ATTEMPTS_PER_IP,
  readAttemptWindow,
  recordFailedAttempt,
  toPublicLink,
} from "./utils";

import type { TRPCContext } from "../../trpc";
import type { Link } from "@/server/db/schema";

const PASSWORD = "correct horse";

const protectedLink: Link = {
  id: 42,
  name: "Launch plan",
  url: "https://example.com/secret-destination",
  alias: "launch",
  domain: "ishortn.ink",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  disableLinkAfterClicks: null,
  disableLinkAfterDate: null,
  activateAt: null,
  disabled: false,
  publicStats: false,
  userId: "user_owner",
  teamId: 7,
  createdByUserId: "user_creator",
  passwordHash: bcrypt.hashSync(PASSWORD, 4),
  note: "private note",
  metadata: { title: "Launch", description: "Our launch", image: "https://example.com/og.png" },
  utmParams: { utm_source: "newsletter" },
  tags: null,
  archived: false,
  folderId: null,
  campaignId: null,
  cloaking: false,
  verifiedClicksEnabled: false,
  isQrCode: false,
  isBioLink: false,
  blocked: false,
  blockedAt: null,
  blockedReason: "internal moderation note",
};

const FORBIDDEN_KEYS = [
  "url",
  "passwordHash",
  "userId",
  "createdByUserId",
  "teamId",
  "note",
  "blockedReason",
  "utmParams",
];

function publicCaller(ip = "203.0.113.7") {
  const db = {
    query: {
      link: {
        findFirst: async () => protectedLink,
      },
    },
  };
  // SAFETY: the public link procedures only read ctx.db.query.link.findFirst and
  // ctx.headers on the paths exercised here (wrong password, rate limit); the
  // alias lookup is served from the KV stub below.
  const ctx = {
    db,
    headers: new Headers({ "cf-connecting-ip": ip }),
  } as TRPCContext;
  return linkRouter.createCaller(ctx);
}

// OpenNext reads the request context (and the KV binding behind the cache
// helpers) from this global.
const CLOUDFLARE_CONTEXT = Symbol.for("__cloudflare-context__");
const kvStore = new Map<string, string>();

beforeAll(() => {
  Reflect.set(globalThis, CLOUDFLARE_CONTEXT, {
    env: {
      LINK_CACHE_KV: {
        get: async (key: string) => kvStore.get(key) ?? null,
        put: async (key: string, value: string) => void kvStore.set(key, value),
        delete: async (key: string) => void kvStore.delete(key),
      },
    },
    cf: {},
    ctx: { waitUntil: () => {} },
  });
});

afterAll(() => {
  Reflect.deleteProperty(globalThis, CLOUDFLARE_CONTEXT);
});

beforeEach(() => {
  kvStore.clear();
});

describe("public link lookup", () => {
  test("a password-protected link exposes no destination, hash, owner or note fields", async () => {
    // The lookup is cache-first, so the cached row is what the procedure reads.
    kvStore.set(buildCacheKey("ishortn.ink", "launch"), JSON.stringify(protectedLink));
    const result = await publicCaller().retrieveOriginalUrl({
      alias: "launch",
      domain: "ishortn.ink",
      from: "metadata",
    });

    expect(result).not.toBeNull();
    for (const key of FORBIDDEN_KEYS) {
      expect(result).not.toHaveProperty(key);
    }
    expect(JSON.stringify(result)).not.toContain("secret-destination");
    expect(result).toEqual({
      id: 42,
      alias: "launch",
      domain: "ishortn.ink",
      metadata: { title: "Launch", description: "Our launch", image: "https://example.com/og.png" },
      blocked: false,
      disabled: false,
      disableLinkAfterDate: null,
      activateAt: null,
      hasPassword: true,
    });
  });

  test("toPublicLink drops metadata fields it doesn't know", () => {
    const result = toPublicLink({
      ...protectedLink,
      passwordHash: null,
      metadata: { title: "Launch", owner: "user_owner" },
    });
    expect(result.hasPassword).toBe(false);
    expect(result.metadata).toEqual({ title: "Launch", description: undefined, image: undefined });
  });
});

async function verifyError(caller: ReturnType<typeof publicCaller>, password: string) {
  try {
    await caller.verifyLinkPassword({ id: protectedLink.id, password });
  } catch (error) {
    if (error instanceof TRPCError) return error;
    throw error;
  }
  throw new Error("expected verifyLinkPassword to fail");
}

describe("verifyLinkPassword", () => {
  test("a wrong password gets a generic error without signing in", async () => {
    const error = await verifyError(publicCaller(), "wrong");
    expect(error.code).toBe("BAD_REQUEST");
    expect(error.message).toBe("Wrong password, try again");
  });

  test("refuses the 11th attempt in the window, even with the right password", async () => {
    const caller = publicCaller();
    for (let i = 0; i < PASSWORD_ATTEMPTS_PER_IP; i++) {
      expect((await verifyError(caller, `wrong-${i}`)).code).toBe("BAD_REQUEST");
    }

    const limited = await verifyError(caller, PASSWORD);
    expect(limited.code).toBe("TOO_MANY_REQUESTS");
    expect(limited.message).toBe("Too many attempts, try again later");

    // Another visitor is still allowed to try the same link.
    expect((await verifyError(publicCaller("198.51.100.9"), "wrong")).code).toBe("BAD_REQUEST");
  });
});

describe("password attempt window", () => {
  test("counts failures and resets once the window has passed", () => {
    const now = 1_000_000;
    const first = readAttemptWindow(null, now);
    expect(first).toEqual({ count: 0, resetAt: now + PASSWORD_ATTEMPT_WINDOW_MS });

    const stored = recordFailedAttempt(first);
    expect(readAttemptWindow(stored, now + 1000)).toEqual({ count: 1, resetAt: first.resetAt });
    expect(readAttemptWindow(stored, first.resetAt).count).toBe(0);
  });

  test("treats a malformed value as a fresh window", () => {
    expect(readAttemptWindow("garbage", 5).count).toBe(0);
  });
});
