import { aiRouter } from "./routers/ai/ai.procedure";
import { customDomainRouter } from "./routers/domains/domains.procedure";
import { lemonsqueezyRouter } from "./routers/lemonsqueezy/lemonsqueezy.procedure";
import { linkRouter } from "./routers/link/link.procedure";
import { qrCodeRouter } from "./routers/qrcode/qrcode.procedure";
import { siteSettingsRouter } from "./routers/settings/settings.procedure";
import { subscriptionsRouter } from "./routers/subscriptions/subscriptions.procedure";
import { tagRouter } from "./routers/tag/tag.router";
import { tokenRouter } from "./routers/token/token.procedure";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  link: linkRouter,
  token: tokenRouter,
  lemonsqueezy: lemonsqueezyRouter,
  subscriptions: subscriptionsRouter,
  qrCode: qrCodeRouter,
  customDomain: customDomainRouter,
  ai: aiRouter,
  siteSettings: siteSettingsRouter,
  tag: tagRouter,
});

export type AppRouter = typeof appRouter;
