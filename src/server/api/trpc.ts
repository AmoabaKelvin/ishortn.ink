import { auth } from "@clerk/nextjs/server";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { TEAM_READ_ONLY_MESSAGE } from "@/lib/billing/entitlements";
import { DEFAULT_PLATFORM_DOMAIN } from "@/lib/constants/domains";
import { ACCOUNT_RESTRICTED_MESSAGE } from "@/lib/constants/moderation";
import { db } from "@/server/db";
import { ensureUser, type UserAccess } from "@/server/lib/ensure-user";
import {
  resolveWorkspaceContext,
  userHasUltraPlan,
  WorkspaceContext,
} from "@/server/lib/workspace";

import type { inferAsyncReturnType } from "@trpc/server";

export const createTRPCContext = async (opts: {
  auth: Awaited<ReturnType<typeof auth>>;
  headers: Headers;
}) => {
  return {
    db,
    ...opts,
    headers: opts.headers,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  // eslint-disable-next-line anti-slop/no-shape-in-symbol-names -- tRPC errorFormatter API name
  errorFormatter({ shape: formatted, error }) {
    return {
      ...formatted,
      data: {
        ...formatted.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

// Base context type
export type TRPCContext = inferAsyncReturnType<typeof createTRPCContext>;

// Protected context type with enforced userId
export type ProtectedTRPCContext = Omit<TRPCContext, "auth"> & {
  auth: Omit<NonNullable<TRPCContext["auth"]>, "userId"> & {
    userId: string;
  };
  /** Whether the user has isAdmin=true, fetched once during auth */
  isAdmin: boolean;
  deletedAt: Date | null;
  /** Set when moderation restricted the account; see contentWriteProcedure */
  restrictedAt: Date | null;
};

// Per-request memo so batched procedures share one ban/admin lookup.
// Keyed on the ctx object — same request = same ctx = same cached promise.
const currentUserCache = new WeakMap<object, Promise<UserAccess | undefined>>();

// Like protectedProcedure, but still reachable after a soft delete.
export const softDeletedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.auth.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  let cached = currentUserCache.get(ctx);
  if (!cached) {
    cached = ensureUser(ctx.auth.userId);
    currentUserCache.set(ctx, cached);
  }
  const currentUser = await cached;

  if (currentUser?.banned) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your account has been suspended. Please contact support for more information.",
    });
  }

  const protectedCtx: ProtectedTRPCContext = {
    ...ctx,
    auth: {
      ...ctx.auth,
      userId: ctx.auth.userId,
    },
    isAdmin: currentUser?.isAdmin ?? false,
    deletedAt: currentUser?.deletedAt ?? null,
    restrictedAt: currentUser?.restrictedAt ?? null,
  };

  return next({ ctx: protectedCtx });
});

// Protected procedure middleware
export const protectedProcedure = softDeletedProcedure.use(({ ctx, next }) => {
  if (ctx.deletedAt) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This account is scheduled for deletion. Restore it to keep using iShortn.",
    });
  }

  return next({ ctx });
});

// ============================================================================
// WORKSPACE-AWARE PROCEDURES
// ============================================================================

/**
 * Context type with workspace information
 */
export type WorkspaceTRPCContext = ProtectedTRPCContext & {
  workspace: WorkspaceContext;
};

/**
 * Workspace-aware procedure that resolves the current workspace from the hostname.
 * This should be used for all operations that need workspace context.
 */
export const workspaceProcedure = protectedProcedure.use(async ({ ctx, next, type, path }) => {
  const hostname = ctx.headers.get("host") ?? DEFAULT_PLATFORM_DOMAIN;

  const workspace = await resolveWorkspaceContext(ctx.auth.userId, hostname, ctx.db);

  // A team whose owner is not on Ultra (past the grace period) is read-only for
  // every member. Every workspace mutation goes through here, so this is the one
  // gate; only the ways out of the team stay open.
  if (
    workspace.type === "team" &&
    workspace.readOnly &&
    type === "mutation" &&
    !READ_ONLY_TEAM_MUTATIONS.has(path)
  ) {
    throw new TRPCError({ code: "FORBIDDEN", message: TEAM_READ_ONLY_MESSAGE });
  }

  return next({ ctx: { ...ctx, workspace } });
});

// Mutations a read-only team still allows: leaving or winding the team down,
// revoking its API keys, and ones that only read (members can still get their links out).
const READ_ONLY_TEAM_MUTATIONS = new Set([
  "link.exportUserLinks",
  "link.validateTransfer",
  "team.leave",
  "team.delete",
  "team.transferOwnership",
  "team.removeMember",
  "team.revokeInvite",
  "token.deleteTeam",
]);

/**
 * Workspace procedure for creating or editing links, custom domains, bio pages
 * and QR codes. A restricted account keeps read, delete and billing access but
 * is refused here in every workspace, personal or team.
 */
export const contentWriteProcedure = workspaceProcedure.use(({ ctx, next }) => {
  if (ctx.restrictedAt) {
    throw new TRPCError({ code: "FORBIDDEN", message: ACCOUNT_RESTRICTED_MESSAGE });
  }

  return next({ ctx });
});

/**
 * Context type for team-only procedures
 */
export type TeamTRPCContext = ProtectedTRPCContext & {
  workspace: Extract<WorkspaceContext, { type: "team" }>;
};

/**
 * Procedure that requires a team workspace.
 * Throws FORBIDDEN if called from a personal workspace.
 */
export const teamProcedure = workspaceProcedure.use(({ ctx, next }) => {
  if (ctx.workspace.type !== "team") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This action requires a team workspace",
    });
  }

  return next({ ctx: { ...ctx, workspace: ctx.workspace } });
});

/**
 * Procedure that requires the user to have an Ultra plan.
 * Used for team creation and other Ultra-only features.
 */
export const ultraProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const hasUltra = await userHasUltraPlan(ctx.auth.userId, ctx.db);

  if (!hasUltra) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This feature requires an Ultra plan subscription",
    });
  }

  return next({ ctx });
});

/**
 * Admin procedure that requires the user to have isAdmin=true.
 * Reads from context (already fetched in protectedProcedure) — no extra DB query.
 */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }

  return next({ ctx });
});

export type PublicTRPCContext = {
  db: TRPCContext["db"];
  headers: TRPCContext["headers"];
};
