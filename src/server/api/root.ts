import { linkRouter } from "./routers/link/link.procedure";
import { tokenRouter } from "./routers/token/token.procedure";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  link: linkRouter,
  token: tokenRouter,
});

export type AppRouter = typeof appRouter;
