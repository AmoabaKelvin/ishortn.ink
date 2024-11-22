import { TRPCError, initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { db } from "@/server/db";

import type { getAuth } from "@clerk/nextjs/server";
import type { inferAsyncReturnType } from "@trpc/server";
export const createTRPCContext = async (opts: {
  auth: ReturnType<typeof getAuth>;
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

export type PublicTRPCContext = {
  db: TRPCContext["db"];
  headers: TRPCContext["headers"];
};
