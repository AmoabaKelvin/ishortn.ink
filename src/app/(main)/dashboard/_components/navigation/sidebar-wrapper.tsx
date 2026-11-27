import { api } from "@/trpc/server";

import { getDashboardSubscription } from "../../_lib/get-subscription";
import { AppSidebar } from "./app-sidebar";
import { visitsUpgradeReason } from "./sidebar-upgrade-reason";

interface SidebarWrapperProps {
  isAdmin: boolean;
  userName: string | null;
}

export async function SidebarWrapper({ isAdmin, userName }: SidebarWrapperProps) {
  // Fetch subscription, teams, and workspace in parallel
  const [userSubscription, teams, currentWorkspace] = await Promise.all([
    getDashboardSubscription(),
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
  const qrCodes = userSubscription?.usage?.qrCodes;
  const plan = userSubscription?.plan ?? "free";
  // The Free upgrade button's other reasons need clicks and domains; not awaited, so the
  // sidebar streams them in instead of holding up the dashboard.
  const upgradeSignals =
    plan === "free" && currentWorkspace.type === "personal" && !visitsUpgradeReason(events)
      ? api.subscriptions.upgradeSignals.query().catch(() => null)
      : null;
  // Use the dedicated canCreateTeam field which checks personal subscription
  const canCreateTeam = userSubscription?.canCreateTeam ?? false;

  return (
    <AppSidebar
      userHasPaidPlan={userHasPaidPlan}
      monthlyLinkCount={monthlyLinkCount}
      linkLimit={linkLimit}
      eventUsage={events}
      folderUsage={folders}
      qrCodeUsage={qrCodes}
      upgradeSignals={upgradeSignals}
      plan={plan}
      teams={teams}
      currentWorkspace={currentWorkspace}
      canCreateTeam={canCreateTeam}
      isAdmin={isAdmin}
      userName={userName}
    />
  );
}
