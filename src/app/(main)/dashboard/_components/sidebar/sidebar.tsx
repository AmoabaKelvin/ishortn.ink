import MonthlyUsage from "@/app/(main)/dashboard/_components/sidebar/monthly-usage";
import { UpgradeToPro } from "@/components/upgrade-to-pro";

import { QuickLinkShorteningForm } from "./quick-link-shortening-form";
import { UserLinksOverView } from "./user-links-overview";

type DashboardSidebarProps = {
  numberOfLinks: number;
  numberOfClicks: number;
  userHasProPlan: boolean;
  monthlyLinkCount: number;
};

const DashboardSidebar = ({
  numberOfLinks,
  numberOfClicks,
  userHasProPlan,
  monthlyLinkCount,
}: DashboardSidebarProps) => {
  return (
    <div className="col-span-11 flex w-full flex-col gap-4 md:col-span-4 ">
      {userHasProPlan ? null : <UpgradeToPro />}
      <QuickLinkShorteningForm />
      <UserLinksOverView
        numberOfLinks={numberOfLinks}
        numberOfClicks={numberOfClicks}
      />
      <MonthlyUsage
        monthlyLinkCount={monthlyLinkCount}
        isProUser={userHasProPlan}
      />
      {/* <BuyMeACoffee /> */}
      {/* <UpgradeToPro /> */}
    </div>
  );
};

export { DashboardSidebar };
