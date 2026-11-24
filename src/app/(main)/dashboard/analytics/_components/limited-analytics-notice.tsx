import { cn } from "@/lib/utils";

import { PromoOfferSuffix } from "../../_components/upgrade-offer";
import UpgradeText from "../../qrcodes/_components/upgrade-text";
import { limitedAnalyticsCopy } from "./limited-analytics-copy";

type LimitedAnalyticsNoticeProps = {
  /** Clicks older than the Free analytics window. */
  hiddenClicks: number;
  /** Where the prompt sits, for upgrade-prompt analytics. */
  source: string;
  className?: string;
};

/** The Free-plan line under an analytics page title: what the window hides, and the upgrade link. */
export function LimitedAnalyticsNotice({
  hiddenClicks,
  source,
  className,
}: LimitedAnalyticsNoticeProps) {
  const { lead, tail } = limitedAnalyticsCopy(hiddenClicks);
  return (
    <p className={cn("text-[13px] text-neutral-400 dark:text-neutral-500", className)}>
      {lead}{" "}
      <UpgradeText
        text="Upgrade to Pro"
        source={source}
        trackingProperties={{ hidden_clicks: hiddenClicks }}
      />{" "}
      {tail}
      <PromoOfferSuffix />
    </p>
  );
}
