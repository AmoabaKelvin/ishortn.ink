import { Crown, Fingerprint, MapPinned, MousePointerClick } from "lucide-react";

import { aggregateVisits } from "@/lib/core/analytics";
import { api } from "@/trpc/server";

import UpgradeText from "../../qrcodes/_components/upgrade-text";

import { BarChart } from "./_components/bar-chart";
import { CountriesAndCitiesStats } from "./_components/countries-and-cities-stats";
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

export default async function LinkAnalyticsPage(
  props: LinksAnalyticsPageProps
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const range = (searchParams?.range ?? "7d") as RangeEnum;
  const domain = (searchParams?.domain as string) ?? "ishortn.ink";

  const {
    totalVisits,
    uniqueVisits,
    topCountry,
    referers,
    topReferrer,
    isProPlan,
  } = await api.link.linkVisits.query({
    id: params.alias,
    domain,
    range,
  });

  const aggregatedVisits = aggregateVisits(totalVisits, uniqueVisits);
  const countryData = aggregatedVisits.clicksPerCountry;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col items-center justify-between md:flex-row">
        <div className="flex flex-col gap-1">
          <h1 className="font-semibold leading-tight text-blue-600 cursor-pointer hover:underline md:text-3xl">
            {searchParams?.domain}/{params.alias}
          </h1>
          {!isProPlan && (
            <div className="mt-2 text-sm text-center text-gray-500">
              You are viewing limited analytics data (last 7 days).{" "}
              <UpgradeText text="Upgrade to Pro" /> for full analytics.
            </div>
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
      <div className="grid grid-cols-1 gap-4 mt-5 md:mt-10 md:grid-cols-4">
        <QuickInfoCard
          title="Total Visits"
          value={totalVisits.length}
          icon={<MousePointerClick className="size-4" />}
        />
        <QuickInfoCard
          title="Unique Visits"
          value={uniqueVisits.length}
          icon={<Fingerprint className="size-4" />}
        />
        <QuickInfoCard
          title="Top Country"
          value={topCountry}
          icon={<MapPinned className="size-4" />}
        />
        <QuickInfoCard
          title="Top Referrer"
          value={topReferrer}
          icon={<Crown className="size-4" />}
        />
      </div>

      <div className="mt-10 md:mt-14">
        <BarChart
          clicksPerDate={aggregatedVisits.clicksPerDate}
          uniqueClicksPerDate={aggregatedVisits.uniqueClicksPerDate ?? {}}
          className="h-96"
          isProPlan={isProPlan}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 mt-5 md:mt-14 md:grid-cols-10">
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
      </div>

      {isProPlan && (
        <div className="mt-10 md:mt-14">
          <h2 className="mb-8 text-2xl font-semibold">
            Global Link Clicks Distribution
          </h2>
          <WorldMapHeatmap data={countryData} />
        </div>
      )}
    </div>
  );
}
