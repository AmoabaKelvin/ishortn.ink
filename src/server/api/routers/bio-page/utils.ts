import { TRPCError } from "@trpc/server";
import { count } from "drizzle-orm";

import { getBioPageLimit } from "@/lib/billing/plans";
import { bioPage } from "@/server/db/schema";
import { workspaceFilter } from "@/server/lib/workspace";

import type { BioPage } from "@/server/db/schema";
import type { WorkspaceTRPCContext } from "../../trpc";

// Handles live at /p/<slug>, but we still exclude every top-level app route name
// defensively (in case bio pages are ever lifted to the root namespace) plus
// common brand/impersonation terms. Uniqueness is also enforced at the DB level.
export const RESERVED_BIO_SLUGS = new Set([
  "p", "api", "trpc", "dashboard", "auth", "account", "teams", "team",
  "blocked", "expired", "cloaked", "verified-redirect", "verify-password",
  "blog", "changelog", "privacy", "terms", "abuse", "features", "pricing",
  "compare", "admin", "settings", "login", "logout", "signup", "sign-up",
  "sign-in", "signin", "new", "opengraph-image", "favicon", "robots",
  "sitemap", "www", "app", "mail", "support", "help", "status", "about",
  "contact", "ishortn", "null", "undefined",
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
export function rethrowBioDuplicate(error: unknown): never {
  const message = String((error as { message?: string })?.message ?? "");
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
