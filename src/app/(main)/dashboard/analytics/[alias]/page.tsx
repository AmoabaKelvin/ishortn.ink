import { IconClick, IconShieldCheck, IconShieldHalf, IconUsers } from "@tabler/icons-react";

import { DEFAULT_PLATFORM_DOMAIN } from "@/lib/constants/domains";
import { aggregateVisits } from "@/lib/core/analytics";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/server";

import UpgradeText from "../../qrcodes/_components/upgrade-text";
import { AnalyticsTracker } from "../_components/analytics-tracker";

import { BarChart } from "./_components/bar-chart";
import { CountriesAndCitiesStats } from "./_components/countries-and-cities-stats";
import { GeoRulesStats } from "./_components/geo-rules-stats";
import { QuickInfoCard } from "./_components/quick-info-card";
import { RangeSelectorWrapper } from "./_components/range-selector-wrapper";
import { ReferrerStats } from "./_components/referrers";
import { UserAgentStats } from "./_components/user-agent-stats";
import WorldMapHeatmap from "./_components/world-map-heatmap";

import type { RangeEnum } from "@/server/api/routers/link/link.input";
type LinksAnalyticsPageProps = {
  params: Promise<{
    alias: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Null when prior is 0 — a 0→N change has no meaningful ratio, so hide the pill
// rather than show a misleading 100%/∞.
const percentGrowth = (current: number, prior: number | undefined | null) => {
  if (prior === undefined || prior === null || prior === 0) return null;
  return ((current - prior) / prior) * 100;
};

export default async function LinkAnalyticsPage(
  props: LinksAnalyticsPageProps
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const range = (searchParams?.range ?? "7d") as RangeEnum;
  const domain = (searchParams?.domain as string) ?? DEFAULT_PLATFORM_DOMAIN;

  const { totalVisits, uniqueVisits, referers, isProPlan, geoRules, previous } =
    await api.link.linkVisits.query({
      id: params.alias,
      domain,
      range,
    });

  const aggregatedVisits = aggregateVisits(totalVisits, uniqueVisits);
  const countryData = aggregatedVisits.clicksPerCountry;
  const verifiedVisits = aggregatedVisits.verifiedClicks;

  const totalGrowth = percentGrowth(totalVisits.length, previous?.total);
  const uniqueGrowth = percentGrowth(uniqueVisits.length, previous?.unique);
  const verifiedGrowth = percentGrowth(verifiedVisits, previous?.verified);
  const verifiedRate = totalVisits.length > 0 ? (verifiedVisits / totalVisits.length) * 100 : 0;

  return (
    <div>
      <AnalyticsTracker alias={params.alias} domain={domain} />
      <div className="flex flex-col items-center justify-between md:flex-row">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold leading-tight tracking-tight text-neutral-900 dark:text-foreground md:text-2xl">
            {searchParams?.domain}/{params.alias}
          </h1>
          {!isProPlan && (
            <p className="mt-1 text-[13px] text-neutral-400 dark:text-neutral-500">
              Viewing limited analytics (last 7 days).{" "}
              <UpgradeText text="Upgrade to Pro" /> for full data.
            </p>
          )}
        </div>

        <RangeSelectorWrapper
          initialRange={range}
          isProPlan={isProPlan!}
          domain={domain}
          alias={params.alias}
        />
      </div>

      {/* quick info cards */}
      <div
        className={cn(
          "mt-6 grid grid-cols-2 gap-3 md:mt-8 md:gap-4",
          verifiedVisits > 0 ? "md:grid-cols-4" : "md:grid-cols-2",
        )}
      >
        <QuickInfoCard
          title="Total Visits"
          value={totalVisits.length.toLocaleString()}
          icon={<IconClick size={14} stroke={1.5} />}
          growth={totalGrowth}
        />
        <QuickInfoCard
          title="Unique Visits"
          value={uniqueVisits.length.toLocaleString()}
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
          clicksPerDate={aggregatedVisits.clicksPerDate}
          uniqueClicksPerDate={aggregatedVisits.uniqueClicksPerDate ?? {}}
          className="h-96"
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
    </div>
  );
}
