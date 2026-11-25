import { IconClick, IconTrendingUp, IconUsers, IconWorld } from "@tabler/icons-react";
import { z } from "zod";

import { QuickInfoCard } from "@/app/(main)/dashboard/analytics/[alias]/_components/quick-info-card";
import {
  aggregateVisits,
  fillClickSeries,
  mergeArchivedClicks,
  parseCustomRange,
} from "@/lib/core/analytics";
import {
  allAnalyticsSchema,
  analyticsFilterTypeEnum,
  analyticsRangeEnum,
} from "@/server/api/routers/link/link.input";
import { api } from "@/trpc/server";

export const dynamic = "force-dynamic";

import { RangeSelectorWrapper } from "../[alias]/_components/range-selector-wrapper";
import { AnalyticsTracker } from "../_components/analytics-tracker";
import { ExportClicksButton } from "../_components/export-clicks-button";
import { LimitedAnalyticsNotice } from "../_components/limited-analytics-notice";
import { RangePendingContent, RangeTransitionProvider } from "../_components/range-transition";
import { AnalyticsFilter } from "./_components/analytics-filter";
import { DestinationUrlsCard } from "./_components/destination-urls-card";
import { DeviceStatsCard } from "./_components/device-stats-card";
import { GeographicStatsCard } from "./_components/geographic-stats-card";
import { OverallClicksChart } from "./_components/overall-clicks-chart";
import { ReferrersCard } from "./_components/referrers-card";
import { ShortLinksCard } from "./_components/short-links-card";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Analytics" };

// Search params are user-controlled, so a bad value falls back to the default
// instead of erroring the page. The tRPC input stays strict.
const overviewSearchParamsSchema = allAnalyticsSchema.extend({
  range: analyticsRangeEnum.catch("7d"),
  filterType: analyticsFilterTypeEnum.catch("all"),
  from: z.string().optional().catch(undefined),
  to: z.string().optional().catch(undefined),
});

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

type AnalyticsOverviewPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AnalyticsOverviewPage(props: AnalyticsOverviewPageProps) {
  const searchParams = await props.searchParams;
  const {
    range: requestedRange,
    filterType,
    filterId,
    from,
    to,
  } = overviewSearchParamsSchema.parse({
    range: searchParams?.range,
    from: firstParam(searchParams?.from),
    to: firstParam(searchParams?.to),
    filterType: searchParams?.filterType,
    filterId: Array.isArray(searchParams?.filterId)
      ? searchParams.filterId[0]
      : searchParams?.filterId || undefined,
  });
  const {
    totalVisits,
    uniqueVisits,
    topCountry,
    referers,
    topReferrer,
    isProPlan,
    clicksByLink,
    clicksByDestination,
    archived,
    hiddenClicks,
    range,
    custom,
    window,
  } = await api.link.allAnalytics.query({
    range: requestedRange,
    ...parseCustomRange(from, to),
    filterType,
    filterId,
  });

  const aggregatedVisits = aggregateVisits(totalVisits, uniqueVisits, window.granularity);
  const series = fillClickSeries(mergeArchivedClicks(aggregatedVisits, archived), window);

  return (
    <RangeTransitionProvider range={range} custom={custom}>
      <AnalyticsTracker isOverview />
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold leading-tight tracking-tight text-neutral-900 dark:text-foreground md:text-2xl">
            Analytics Overview
          </h1>
          {!isProPlan && (
            <LimitedAnalyticsNotice
              hiddenClicks={hiddenClicks}
              source="analytics_overview"
              className="mt-1"
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AnalyticsFilter />
          <RangeSelectorWrapper isProPlan={isProPlan} />
          <ExportClicksButton
            isProPlan={isProPlan}
            query={{ range: requestedRange, ...parseCustomRange(from, to), filterType, filterId }}
            fileName={`clicks-${range}`}
          />
        </div>
      </div>

      <RangePendingContent>
        {/* Quick Info Cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:mt-8 md:grid-cols-4">
          <QuickInfoCard
            title="Total Clicks"
            value={(totalVisits.length + archived.clicks).toLocaleString()}
            icon={<IconClick size={16} stroke={1.5} className="text-blue-600 dark:text-blue-400" />}
          />
          <QuickInfoCard
            title="Unique Visitors"
            value={(uniqueVisits.length + archived.uniqueClicks).toLocaleString()}
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
            icon={
              <IconTrendingUp size={16} stroke={1.5} className="text-blue-600 dark:text-blue-400" />
            }
          />
        </div>

        {/* Time Series Chart */}
        <div className="mt-8 md:mt-10">
          <OverallClicksChart series={series} />
        </div>

        {/* Distribution Cards Grid */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:mt-10 lg:auto-rows-fr lg:grid-cols-2">
          <ShortLinksCard clicksByLink={clicksByLink} totalClicks={totalVisits.length} />
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
      </RangePendingContent>
    </RangeTransitionProvider>
  );
}
