import { TRPCError } from "@trpc/server";
import { and, count, eq } from "drizzle-orm";

import { getBioLinkBlockLimit, getBioPageLimit } from "@/lib/billing/plans";
import { bioBlock, bioPage } from "@/server/db/schema";
import { workspaceFilter } from "@/server/lib/workspace";

import type { WorkspaceTRPCContext } from "../../trpc";
import type { Plan } from "@/lib/billing/plans";
import type { db } from "@/server/db";
import type { BioPage, BioPageTheme } from "@/server/db/schema";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Handles live at /p/<slug>, but we still exclude every top-level app route name
// defensively (in case bio pages are ever lifted to the root namespace) plus
// common brand/impersonation terms. Uniqueness is also enforced at the DB level.
export const RESERVED_BIO_SLUGS = new Set([
  "p",
  "api",
  "trpc",
  "dashboard",
  "auth",
  "account",
  "teams",
  "team",
  "blocked",
  "expired",
  "cloaked",
  "verified-redirect",
  "verify-password",
  "blog",
  "changelog",
  "privacy",
  "terms",
  "abuse",
  "features",
  "pricing",
  "compare",
  "qr-code-generator",
  "utm-builder",
  "admin",
  "settings",
  "login",
  "logout",
  "signup",
  "sign-up",
  "sign-in",
  "signin",
  "new",
  "opengraph-image",
  "favicon",
  "robots",
  "sitemap",
  "www",
  "app",
  "mail",
  "support",
  "help",
  "status",
  "about",
  "contact",
  "ishortn",
  "null",
  "undefined",
]);

export function assertSlugAllowed(slug: string): void {
  if (RESERVED_BIO_SLUGS.has(slug.toLowerCase())) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "That handle is reserved. Please choose another.",
    });
  }
}

/** Enforce the per-plan bio-page count cap for the current workspace. */
export async function checkBioPageLimit(ctx: WorkspaceTRPCContext): Promise<void> {
  const limit = getBioPageLimit(ctx.workspace.plan);
  if (limit === undefined) return; // unlimited (Ultra / team workspaces)

  const [row] = await ctx.db
    .select({ count: count() })
    .from(bioPage)
    .where(workspaceFilter(ctx.workspace, bioPage.userId, bioPage.teamId));

  const current = Number(row?.count ?? 0);
  if (current >= limit) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        ctx.workspace.plan === "free"
          ? `You've reached the free plan limit of ${limit} bio page. Upgrade to Pro for more.`
          : `You've reached your plan's limit of ${limit} bio pages. Upgrade to Ultra for unlimited pages.`,
    });
  }
}

/**
 * Throws when a bio page already holds its plan's maximum number of link
 * blocks. Only link blocks are capped: they're the ones backed by a link row.
 */
export function assertBioLinkBlockCapacity(plan: Plan, currentLinkBlocks: number): void {
  const limit = getBioLinkBlockLimit(plan);
  if (limit === undefined || currentLinkBlocks < limit) return;

  throw new TRPCError({
    code: "FORBIDDEN",
    message: `The free plan allows ${limit} link blocks per bio page. Upgrade to Pro for unlimited link blocks.`,
  });
}

/**
 * Enforce the per-plan link-block cap for one bio page, inside the transaction
 * that inserts the block. Locking the page row first serializes concurrent
 * adds to the same page, and because the lock is the transaction's first read,
 * the count's snapshot is taken after it and sees every block committed by the
 * add that held the lock before us. Uncapped plans skip both queries.
 */
export async function lockBioLinkBlockCapacity(
  tx: TransactionClient,
  plan: Plan,
  bioPageId: number,
): Promise<void> {
  if (getBioLinkBlockLimit(plan) === undefined) return;

  await tx.select({ id: bioPage.id }).from(bioPage).where(eq(bioPage.id, bioPageId)).for("update");

  const [row] = await tx
    .select({ count: count() })
    .from(bioBlock)
    .where(and(eq(bioBlock.bioPageId, bioPageId), eq(bioBlock.type, "link")));

  assertBioLinkBlockCapacity(plan, Number(row?.count ?? 0));
}

/** In-memory ownership check mirroring workspaceFilter (for already-loaded rows). */
export function pageBelongsToWorkspace(
  ctx: WorkspaceTRPCContext,
  page: Pick<BioPage, "userId" | "teamId">,
): boolean {
  if (ctx.workspace.type === "team") {
    return page.teamId === ctx.workspace.teamId;
  }
  return page.teamId === null && page.userId === ctx.workspace.userId;
}

/** Translate a MySQL unique-constraint violation into a friendly CONFLICT. */
export function rethrowBioDuplicate(error: Error): never {
  // drizzle-orm >= 0.44 wraps driver errors in DrizzleQueryError; the original
  // mysql2 error (with the constraint name) lives at error.cause.
  const message =
    error.cause instanceof Error ? `${error.message} ${error.cause.message}` : error.message;
  if (/bio_slug_unique/.test(message)) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "That handle is already taken. Please choose another.",
    });
  }
  if (/bio_custom_domain_unique/.test(message)) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "That custom domain is already used by another bio page.",
    });
  }
  throw error;
}

/**
 * Whether a theme the editor resends matches the stored one. MySQL JSON
 * columns don't keep key order, so fields are compared one by one.
 */
export function sameBioTheme(a: BioPageTheme, b: BioPageTheme | null): boolean {
  if (!b) return false;
  const bgA = a.background;
  const bgB = b.background;
  const sameBackground =
    bgA === undefined || bgB === undefined
      ? bgA === bgB
      : bgA.type === bgB.type &&
        bgA.color === bgB.color &&
        bgA.from === bgB.from &&
        bgA.to === bgB.to;
  return (
    sameBackground &&
    a.preset === b.preset &&
    a.accentColor === b.accentColor &&
    a.buttonStyle === b.buttonStyle &&
    a.font === b.font
  );
}
