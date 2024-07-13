import { createTRPCRouter, protectedProcedure } from "../../trpc";

export const subscriptionsRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.auth.userId;

    // const subscriptions = await ctx.db.query.subscription.findFirst({
    //   where: (table, { eq }) => eq(table.userId, user),
    //   with: {
    //     user: true,
    //   },
    // });

    const userSubscriptions = await ctx.db.query.user.findFirst({
      where: (table, { eq }) => eq(table.id, user),
      with: {
        subscriptions: true,
      },
    });

    return userSubscriptions;

    // return subscriptions;
  }),
});
