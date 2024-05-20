import { BuyMeACoffee } from "@/components/buy-me-a-coffee";

import { QuickLinkShorteningForm } from "./sidebar/quick-link-shortening-form";
import { UserLinksOverView } from "./sidebar/user-links-overview";

type DashboardSidebarProps = {
  numberOfLinks: number;
  numberOfClicks: number;
};

const DashboardSidebar = ({ numberOfLinks, numberOfClicks }: DashboardSidebarProps) => {
  return (
    <div className="col-span-11 flex w-full flex-col gap-4 md:col-span-4 ">
      <QuickLinkShorteningForm />
      <UserLinksOverView numberOfLinks={numberOfLinks} numberOfClicks={numberOfClicks} />
      <BuyMeACoffee />
    </div>
  );
};

export { DashboardSidebar };
