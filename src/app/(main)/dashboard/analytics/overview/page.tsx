import { IconClick, IconTrendingUp, IconUsers, IconWorld } from "@tabler/icons-react";

import { QuickInfoCard } from "@/app/(main)/dashboard/analytics/[alias]/_components/quick-info-card";
import { aggregateVisits } from "@/lib/core/analytics";
import { api } from "@/trpc/server";

export const dynamic = "force-dynamic";

import UpgradeText from "../../qrcodes/_components/upgrade-text";
import { AnalyticsTracker } from "../_components/analytics-tracker";

import { AnalyticsFilter } from "./_components/analytics-filter";
import { DestinationUrlsCard } from "./_components/destination-urls-card";
import { DeviceStatsCard } from "./_components/device-stats-card";
import { GeographicStatsCard } from "./_components/geographic-stats-card";
import { OverallClicksChart } from "./_components/overall-clicks-chart";
import { OverviewRangeSelector } from "./_components/overview-range-selector";
import { ReferrersCard } from "./_components/referrers-card";
import { ShortLinksCard } from "./_components/short-links-card";

type RangeEnum =
  | "24h"
  | "7d"
  | "30d"
  | "90d"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "all";

type FilterType = "all" | "folder" | "domain" | "link";

type AnalyticsOverviewPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AnalyticsOverviewPage(
  props: AnalyticsOverviewPageProps
) {
  const searchParams = await props.searchParams;
  const range = (searchParams?.range ?? "7d") as RangeEnum;
  const filterType = (searchParams?.filterType ?? "all") as FilterType;
  const filterId = searchParams?.filterId
    ? Array.isArray(searchParams.filterId)
      ? searchParams.filterId[0]
      : searchParams.filterId
    : undefined;

  const {
    totalVisits,
    uniqueVisits,
    topCountry,
    referers,
    topReferrer,
    isProPlan,
    clicksByLink,
    clicksByDestination,
  } = await api.link.allAnalytics.query({
    range,
    filterType,
    filterId,
  });

  const aggregatedVisits = aggregateVisits(totalVisits, uniqueVisits);

  return (
    <div>
      <AnalyticsTracker isOverview />
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold leading-tight tracking-tight text-neutral-900 dark:text-foreground md:text-2xl">
            Analytics Overview
          </h1>
          {!isProPlan && (
            <p className="mt-1 text-[13px] text-neutral-400 dark:text-neutral-500">
              Viewing limited analytics (last 7 days).{" "}
              <UpgradeText text="Upgrade to Pro" /> for full data.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AnalyticsFilter />
          <OverviewRangeSelector initialRange={range} isProPlan={isProPlan!} />
        </div>
      </div>

      {/* Quick Info Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:mt-8 md:grid-cols-4">
        <QuickInfoCard
          title="Total Clicks"
          value={totalVisits.length.toLocaleString()}
          icon={<IconClick size={16} stroke={1.5} className="text-blue-600 dark:text-blue-400" />}
        />
        <QuickInfoCard
          title="Unique Visitors"
          value={uniqueVisits.length.toLocaleString()}
          icon={<IconUsers size={16} stroke={1.5} className="text-blue-600 dark:text-blue-400" />}
        />
        <QuickInfoCard
          title="Top Country"
          value={topCountry}
          icon={<IconWorld size={16} stroke={1.5} className="text-blue-600 dark:text-blue-400" />}
        />
        <QuickInfoCard
          title="Top Referrer"
          value={topReferrer}
          icon={<IconTrendingUp size={16} stroke={1.5} className="text-blue-600 dark:text-blue-400" />}
        />
      </div>

      {/* Time Series Chart */}
      <div className="mt-8 md:mt-10">
        <OverallClicksChart
          clicksPerDate={aggregatedVisits.clicksPerDate}
          uniqueClicksPerDate={aggregatedVisits.uniqueClicksPerDate ?? {}}
        />
      </div>

      {/* Distribution Cards Grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:mt-10 lg:auto-rows-fr lg:grid-cols-2">
        <ShortLinksCard
          clicksByLink={clicksByLink}
          totalClicks={totalVisits.length}
        />
        <DestinationUrlsCard
          clicksByDestination={clicksByDestination}
          totalClicks={totalVisits.length}
        />

        <ReferrersCard referers={referers} totalClicks={totalVisits.length} />
        <GeographicStatsCard
          clicksPerCountry={aggregatedVisits.clicksPerCountry}
          clicksPerCity={aggregatedVisits.clicksPerCity}
          clicksPerContinent={aggregatedVisits.clicksPerContinent}
          totalClicks={totalVisits.length}
        />

        <div className="lg:col-span-2">
          <DeviceStatsCard
            clicksPerDevice={aggregatedVisits.clicksPerDevice}
            clicksPerOS={aggregatedVisits.clicksPerOS}
            clicksPerBrowser={aggregatedVisits.clicksPerBrowser}
            totalClicks={totalVisits.length}
          />
        </div>
      </div>
    </div>
  );
}
