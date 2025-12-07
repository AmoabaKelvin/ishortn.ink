import { api } from "@/trpc/server";

import { AppSidebar } from "./app-sidebar";

export async function SidebarWrapper() {
  const userSubscription = await api.subscriptions.get.query().catch(() => null);

  const userHasPaidPlan = (userSubscription?.plan ?? "free") !== "free";
  const monthlyLinkCount = userSubscription?.usage?.links?.count ?? 0;
  const linkLimit = userSubscription?.usage?.links?.limit ?? null;
  const events = userSubscription?.usage?.events;
  const folders = userSubscription?.usage?.folders;
  const plan = userSubscription?.plan ?? "free";

  return (
    <AppSidebar 
      userHasPaidPlan={userHasPaidPlan} 
      monthlyLinkCount={monthlyLinkCount}
      linkLimit={linkLimit}
      eventUsage={events}
      folderUsage={folders}
      plan={plan}
    />
  );
}
