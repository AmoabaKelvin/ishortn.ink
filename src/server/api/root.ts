import { linkRouter } from "./routers/link/link.procedure";
import { userRouter } from "./routers/user/user.procedure";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  user: userRouter,
  link: linkRouter,
});

export type AppRouter = typeof appRouter;
