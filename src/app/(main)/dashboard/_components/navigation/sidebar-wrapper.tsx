import { api } from "@/trpc/server";

import { AppSidebar } from "./app-sidebar";

export async function SidebarWrapper() {
  // Fetch subscription, teams, and workspace in parallel
  const [userSubscription, teams, currentWorkspace] = await Promise.all([
    api.subscriptions.get.query().catch(() => null),
    api.team.list.query().catch(() => []),
    api.team.currentWorkspace.query().catch(() => ({
      type: "personal" as const,
      plan: "free" as const,
    })),
  ]);

  const userHasPaidPlan = (userSubscription?.plan ?? "free") !== "free";
  const monthlyLinkCount = userSubscription?.usage?.links?.count ?? 0;
  const linkLimit = userSubscription?.usage?.links?.limit ?? null;
  const events = userSubscription?.usage?.events;
  const folders = userSubscription?.usage?.folders;
  const plan = userSubscription?.plan ?? "free";
  // Use the dedicated canCreateTeam field which checks personal subscription
  const canCreateTeam = userSubscription?.canCreateTeam ?? false;

  return (
    <AppSidebar
      userHasPaidPlan={userHasPaidPlan}
      monthlyLinkCount={monthlyLinkCount}
      linkLimit={linkLimit}
      eventUsage={events}
      folderUsage={folders}
      plan={plan}
      teams={teams}
      currentWorkspace={currentWorkspace}
      canCreateTeam={canCreateTeam}
    />
  );
}
