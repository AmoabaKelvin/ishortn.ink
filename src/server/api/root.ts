import { accountTransferRouter } from "./routers/account-transfer/account-transfer.procedure";
import { adminRouter } from "./routers/admin/admin.procedure";
import { aiRouter } from "./routers/ai/ai.procedure";
import { audienceFeedbackRouter } from "./routers/audience-feedback/audience-feedback.procedure";
import { changelogRouter } from "./routers/changelog/changelog.procedure";
import { customDomainRouter } from "./routers/domains/domains.procedure";
import { feedbackRouter } from "./routers/feedback/feedback.procedure";
import { folderRouter } from "./routers/folder/folder.procedure";
import { geoRulesRouter } from "./routers/geo-rules/geo-rules.router";
import { lemonsqueezyRouter } from "./routers/lemonsqueezy/lemonsqueezy.procedure";
import { linkMilestoneRouter } from "./routers/link-milestone/link-milestone.procedure";
import { linkRouter } from "./routers/link/link.procedure";
import { qrCodeRouter } from "./routers/qrcode/qrcode.procedure";
import { siteSettingsRouter } from "./routers/settings/settings.procedure";
import { subscriptionsRouter } from "./routers/subscriptions/subscriptions.procedure";
import { tagRouter } from "./routers/tag/tag.router";
import { teamRouter } from "./routers/team/team.procedure";
import { tokenRouter } from "./routers/token/token.procedure";
import { userRouter } from "./routers/user/user.procedure";
import { utmTemplateRouter } from "./routers/utm-template/utm-template.router";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  accountTransfer: accountTransferRouter,
  admin: adminRouter,
  link: linkRouter,
  token: tokenRouter,
  lemonsqueezy: lemonsqueezyRouter,
  subscriptions: subscriptionsRouter,
  qrCode: qrCodeRouter,
  customDomain: customDomainRouter,
  feedback: feedbackRouter,
  audienceFeedback: audienceFeedbackRouter,
  ai: aiRouter,
  siteSettings: siteSettingsRouter,
  tag: tagRouter,
  folder: folderRouter,
  utmTemplate: utmTemplateRouter,
  changelog: changelogRouter,
  team: teamRouter,
  user: userRouter,
  geoRules: geoRulesRouter,
  linkMilestone: linkMilestoneRouter,
});

export type AppRouter = typeof appRouter;
