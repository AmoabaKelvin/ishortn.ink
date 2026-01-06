import { createTRPCRouter, workspaceProcedure } from "../../trpc";
import * as services from "./subscriptions.service";

export const subscriptionsRouter = createTRPCRouter({
  // Use workspaceProcedure to be workspace-aware
  // Team workspaces always have Ultra features
  get: workspaceProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId;

    // Get user with subscriptions
    const userRecord = await services.getUser(ctx.db, userId);

    // Resolve plan based on workspace context
    const { plan, personalPlan, caps } = await services.resolvePlanForWorkspace(
      ctx.workspace,
      userId,
      userRecord.subscriptions,
      ctx.db
    );

    // Calculate usage metrics
    const usage = await services.calculateWorkspaceUsage(
      ctx.workspace,
      userId,
      ctx.db
    );

    // Build and return the subscription details
    return services.buildSubscriptionDetails(
      ctx.workspace,
      userRecord.subscriptions,
      plan,
      personalPlan,
      caps,
      usage
    );
  }),
});
