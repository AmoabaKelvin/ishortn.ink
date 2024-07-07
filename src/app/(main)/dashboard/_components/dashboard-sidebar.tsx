import { UpgradeToPro } from "@/components/upgrade-to-pro";

import { QuickLinkShorteningForm } from "./sidebar/quick-link-shortening-form";
import { UserLinksOverView } from "./sidebar/user-links-overview";

type DashboardSidebarProps = {
  numberOfLinks: number;
  numberOfClicks: number;
  userHasProPlan: boolean;
};

const DashboardSidebar = ({
  numberOfLinks,
  numberOfClicks,
  userHasProPlan,
}: DashboardSidebarProps) => {
  return (
    <div className="col-span-11 flex w-full flex-col gap-4 md:col-span-4 ">
      {userHasProPlan ? null : <UpgradeToPro />}
      <QuickLinkShorteningForm />
      <UserLinksOverView numberOfLinks={numberOfLinks} numberOfClicks={numberOfClicks} />
      {/* <BuyMeACoffee /> */}
      {/* <UpgradeToPro /> */}
    </div>
  );
};

export { DashboardSidebar };
