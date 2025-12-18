import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../../trpc";
import {
  getChangelogEntries,
  getChangelogEntriesSince,
  getLatestChangelog,
} from "@/lib/changelog";
import { user } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const changelogRouter = createTRPCRouter({
  list: publicProcedure.query(async () => {
    return getChangelogEntries();
  }),

  getLatest: publicProcedure.query(async () => {
    return getLatestChangelog();
  }),

  getNewEntries: protectedProcedure.query(async ({ ctx }) => {
    const userData = await ctx.db.query.user.findFirst({
      where: eq(user.id, ctx.auth.userId),
      columns: {
        lastViewedChangelogDate: true,
      },
    });

    return getChangelogEntriesSince(userData?.lastViewedChangelogDate ?? null);
  }),

  getUnseenCount: protectedProcedure.query(async ({ ctx }) => {
    const userData = await ctx.db.query.user.findFirst({
      where: eq(user.id, ctx.auth.userId),
      columns: {
        lastViewedChangelogDate: true,
      },
    });

    const newEntries = await getChangelogEntriesSince(
      userData?.lastViewedChangelogDate ?? null
    );

    return newEntries.length;
  }),

  markAsViewed: protectedProcedure
    .input(z.object({ date: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(user)
        .set({ lastViewedChangelogDate: input.date })
        .where(eq(user.id, ctx.auth.userId));

      return { success: true };
    }),
});
