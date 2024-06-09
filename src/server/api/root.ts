import { linkRouter } from "./routers/link/link.procedure";
import { tokenRouter } from "./routers/token/token.procedure";
import { userRouter } from "./routers/user/user.procedure";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  user: userRouter,
  link: linkRouter,
  token: tokenRouter,
});

export type AppRouter = typeof appRouter;
