import { Crown, Fingerprint, MapPinned, MousePointerClick } from "lucide-react";

import { QuickInfoCard } from "@/app/(main)/dashboard/analytics/[alias]/_components/quick-info-card";
import { aggregateVisits } from "@/lib/core/analytics";
import { api } from "@/trpc/server";

import UpgradeText from "../../qrcodes/_components/upgrade-text";

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
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-gray-900">
            Analytics Overview
          </h1>
          <p className="text-sm text-gray-500">
            View aggregated analytics across all your links
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AnalyticsFilter />
          <OverviewRangeSelector initialRange={range} isProPlan={isProPlan!} />
          {!isProPlan && <UpgradeText text="Upgrade to Pro" />}
        </div>
      </div>

      {/* Quick Info Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <QuickInfoCard
          title="Total Clicks"
          value={totalVisits.length.toLocaleString()}
          icon={<MousePointerClick className="size-4 text-blue-600" />}
        />
        <QuickInfoCard
          title="Unique Visitors"
          value={uniqueVisits.length.toLocaleString()}
          icon={<Fingerprint className="size-4 text-blue-600" />}
        />
        <QuickInfoCard
          title="Top Country"
          value={topCountry}
          icon={<MapPinned className="size-4 text-blue-600" />}
        />
        <QuickInfoCard
          title="Top Referrer"
          value={topReferrer}
          icon={<Crown className="size-4 text-blue-600" />}
        />
      </div>

      {/* Time Series Chart */}
      <div>
        <OverallClicksChart
          clicksPerDate={aggregatedVisits.clicksPerDate}
          uniqueClicksPerDate={aggregatedVisits.uniqueClicksPerDate ?? {}}
        />
      </div>

      {/* Distribution Cards Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:auto-rows-fr">
        {/* Row 1: Short Links | Destination URLs */}
        <ShortLinksCard
          clicksByLink={clicksByLink}
          totalClicks={totalVisits.length}
        />
        <DestinationUrlsCard
          clicksByDestination={clicksByDestination}
          totalClicks={totalVisits.length}
        />

        {/* Row 2: Referrers | Geographic Stats */}
        <ReferrersCard referers={referers} totalClicks={totalVisits.length} />
        <GeographicStatsCard
          clicksPerCountry={aggregatedVisits.clicksPerCountry}
          clicksPerCity={aggregatedVisits.clicksPerCity}
          clicksPerContinent={aggregatedVisits.clicksPerContinent}
          totalClicks={totalVisits.length}
        />

        {/* Row 3: Device Stats (spans 2 columns) */}
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
