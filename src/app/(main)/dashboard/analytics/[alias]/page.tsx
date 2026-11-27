import { IconClick, IconShieldCheck, IconShieldHalf, IconUsers } from "@tabler/icons-react";
import { notFound } from "next/navigation";
import { z } from "zod";

import {
  aggregateVisits,
  fillClickSeries,
  mergeArchivedClicks,
  parseCustomRange,
} from "@/lib/core/analytics";
import { cn } from "@/lib/utils";
import { analyticsRangeEnum } from "@/server/api/routers/link/link.input";
import { isNotFoundError } from "@/trpc/errors";
import { api } from "@/trpc/server";

import { DestinationDownNotice } from "../../_components/links/link-card/destination-down-badge";
import { AnalyticsTracker } from "../_components/analytics-tracker";
import { ExportClicksButton } from "../_components/export-clicks-button";
import { LimitedAnalyticsNotice } from "../_components/limited-analytics-notice";
import { RangePendingContent, RangeTransitionProvider } from "../_components/range-transition";
import { ShareStatsButton } from "../_components/share-stats-button";
import { BarChart } from "./_components/bar-chart";
import { CountriesAndCitiesStats } from "./_components/countries-and-cities-stats";
import { GeoRulesStats } from "./_components/geo-rules-stats";
import { QuickInfoCard } from "./_components/quick-info-card";
import { RangeSelectorWrapper } from "./_components/range-selector-wrapper";
import { ReferrerStats } from "./_components/referrers";
import { UserAgentStats } from "./_components/user-agent-stats";
import WorldMapHeatmap from "./_components/world-map-heatmap";

import type { RouterOutputs } from "@/trpc/shared";
import type { Metadata } from "next";

export async function generateMetadata(props: {
  params: Promise<{ alias: string }>;
}): Promise<Metadata> {
  const { alias } = await props.params;
  return { title: `Analytics for ${alias}` };
}

type LinksAnalyticsPageProps = {
  params: Promise<{
    alias: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Search params are user-controlled: fall back to defaults rather than error.
// A missing domain resolves to the workspace's default domain on the server.
const analyticsSearchParamsSchema = z.object({
  range: analyticsRangeEnum.catch("7d"),
  domain: z.string().min(1).optional().catch(undefined),
  from: z.string().optional().catch(undefined),
  to: z.string().optional().catch(undefined),
});

// Null when prior is 0 — a 0→N change has no meaningful ratio, so hide the pill
// rather than show a misleading 100%/∞.
const percentGrowth = (current: number, prior: number | undefined | null) => {
  if (prior === undefined || prior === null || prior === 0) return null;
  return ((current - prior) / prior) * 100;
};

export default async function LinkAnalyticsPage(props: LinksAnalyticsPageProps) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const {
    range: requestedRange,
    domain: requestedDomain,
    from,
    to,
  } = analyticsSearchParamsSchema.parse(searchParams);

  let visits: RouterOutputs["link"]["linkVisits"];
  try {
    visits = await api.link.linkVisits.query({
      id: params.alias,
      domain: requestedDomain,
      range: requestedRange,
      ...parseCustomRange(from, to),
    });
  } catch (error) {
    // Only a missing link becomes a 404; auth/server errors must surface.
    if (isNotFoundError(error)) notFound();
    throw error;
  }
  const {
    linkId,
    totalVisits,
    uniqueVisits,
    referers,
    isProPlan,
    geoRules,
    previous,
    archived,
    hiddenClicks,
    destinationDown,
    domain,
    range,
    custom,
    window,
  } = visits;

  const aggregatedVisits = aggregateVisits(totalVisits, uniqueVisits, window.granularity);
  const series = fillClickSeries(mergeArchivedClicks(aggregatedVisits, archived), window);
  const totalClicks = totalVisits.length + archived.clicks;
  const uniqueClicks = uniqueVisits.length + archived.uniqueClicks;
  const countryData = aggregatedVisits.clicksPerCountry;
  const verifiedVisits = aggregatedVisits.verifiedClicks;

  const totalGrowth = percentGrowth(totalClicks, previous?.total);
  const uniqueGrowth = percentGrowth(uniqueClicks, previous?.unique);
  const verifiedGrowth = percentGrowth(verifiedVisits, previous?.verified);
  const verifiedRate = totalVisits.length > 0 ? (verifiedVisits / totalVisits.length) * 100 : 0;

  return (
    <RangeTransitionProvider range={range} custom={custom}>
      <AnalyticsTracker alias={params.alias} domain={domain} />
      <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="break-all text-xl font-semibold leading-tight tracking-tight text-neutral-900 dark:text-foreground md:text-2xl">
            {domain}/{params.alias}
          </h1>
          {destinationDown && <DestinationDownNotice down={destinationDown} className="mt-1" />}
          {!isProPlan && (
            <LimitedAnalyticsNotice
              hiddenClicks={hiddenClicks}
              source="link_analytics"
              className="mt-1"
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <RangeSelectorWrapper isProPlan={isProPlan} />
          <ExportClicksButton
            isProPlan={isProPlan}
            query={{
              range: requestedRange,
              ...parseCustomRange(from, to),
              filterType: "all",
              link: { alias: params.alias, domain },
            }}
            fileName={`clicks-${params.alias}-${range}`}
          />
          <ShareStatsButton linkId={linkId} />
        </div>
      </div>

      <RangePendingContent>
        {/* quick info cards */}
        <div
          className={cn(
            "mt-6 grid grid-cols-2 gap-3 md:mt-8 md:gap-4",
            verifiedVisits > 0 ? "md:grid-cols-4" : "md:grid-cols-2",
          )}
        >
          <QuickInfoCard
            title="Total Visits"
            value={totalClicks.toLocaleString()}
            icon={<IconClick size={14} stroke={1.5} />}
            growth={totalGrowth}
          />
          <QuickInfoCard
            title="Unique Visits"
            value={uniqueClicks.toLocaleString()}
            icon={<IconUsers size={14} stroke={1.5} />}
            growth={uniqueGrowth}
          />
          {verifiedVisits > 0 && (
            <>
              <QuickInfoCard
                title="Verified Visits"
                value={verifiedVisits.toLocaleString()}
                icon={<IconShieldCheck size={14} stroke={1.5} />}
                growth={verifiedGrowth}
              />
              <QuickInfoCard
                title="Verified Rate"
                value={`${verifiedRate.toFixed(verifiedRate >= 10 ? 0 : 1)}%`}
                icon={<IconShieldHalf size={14} stroke={1.5} />}
                hint={`${verifiedVisits} of ${totalVisits.length}`}
              />
            </>
          )}
        </div>

        <div className="mt-8 md:mt-10">
          <BarChart
            series={series}
            isProPlan={isProPlan}
            geoRules={geoRules}
            totalVisits={totalVisits.map((v) => ({
              matchedGeoRuleId: v.matchedGeoRuleId,
            }))}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:mt-10 md:grid-cols-10">
          <CountriesAndCitiesStats
            citiesRecords={aggregatedVisits.clicksPerCity}
            countriesRecords={aggregatedVisits.clicksPerCountry}
            continentsRecords={aggregatedVisits.clicksPerContinent}
            totalClicks={totalVisits.length}
            proUser={!!isProPlan}
          />

          <UserAgentStats
            clicksPerBrowser={aggregatedVisits.clicksPerBrowser}
            clicksPerDevice={aggregatedVisits.clicksPerDevice}
            clicksPerModel={aggregatedVisits.clicksPerModel}
            clicksPerOS={aggregatedVisits.clicksPerOS}
            totalClicks={totalVisits.length}
          />

          <ReferrerStats referers={referers} totalClicks={totalVisits.length} />

          {geoRules.length > 0 && (
            <GeoRulesStats
              totalVisits={totalVisits.map((v) => ({
                matchedGeoRuleId: v.matchedGeoRuleId,
              }))}
              geoRules={geoRules}
              totalClicks={totalVisits.length}
            />
          )}
        </div>

        {isProPlan && (
          <div className="mt-8 md:mt-10">
            <h2 className="mb-6 text-base font-semibold tracking-tight text-neutral-900 dark:text-foreground">
              Global Link Clicks Distribution
            </h2>
            <WorldMapHeatmap data={countryData} />
          </div>
        )}
      </RangePendingContent>
    </RangeTransitionProvider>
  );
}
