import { auth } from "@clerk/nextjs/server";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { db } from "@/server/db";
import {
  resolveWorkspaceContext,
  userHasUltraPlan,
  WorkspaceContext
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
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
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
};

// Protected procedure middleware
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.auth.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      ...ctx,
      auth: {
        ...ctx.auth,
        userId: ctx.auth.userId,
      },
    } as ProtectedTRPCContext,
  });
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
export const workspaceProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    const hostname = ctx.headers.get("host") ?? "ishortn.ink";

    const workspace = await resolveWorkspaceContext(
      ctx.auth.userId,
      hostname,
      ctx.db
    );

    return next({
      ctx: {
        ...ctx,
        workspace,
      } as WorkspaceTRPCContext,
    });
  }
);

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

  return next({
    ctx: ctx as TeamTRPCContext,
  });
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

export type PublicTRPCContext = {
  db: TRPCContext["db"];
  headers: TRPCContext["headers"];
};
