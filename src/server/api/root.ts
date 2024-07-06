import { lemonsqueezyRouter } from "./routers/lemonsqueezy/lemonsqueezy.procedure";
import { linkRouter } from "./routers/link/link.procedure";
import { subscriptionsRouter } from "./routers/subscriptions/subscriptions.procedure";
import { tokenRouter } from "./routers/token/token.procedure";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  link: linkRouter,
  token: tokenRouter,
  lemonsqueezy: lemonsqueezyRouter,
  subscriptions: subscriptionsRouter,
});

export type AppRouter = typeof appRouter;
