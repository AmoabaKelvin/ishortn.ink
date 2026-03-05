import { IconClick, IconTrendingUp, IconUsers, IconWorld } from "@tabler/icons-react";

import { aggregateVisits } from "@/lib/core/analytics";
import { api } from "@/trpc/server";

import UpgradeText from "../_components/upgrade-text";
import { BarChart } from "../../analytics/[alias]/_components/bar-chart";
import { CountriesAndCitiesStats } from "../../analytics/[alias]/_components/countries-and-cities-stats";
import { GeoRulesStats } from "../../analytics/[alias]/_components/geo-rules-stats";
import { QuickInfoCard } from "../../analytics/[alias]/_components/quick-info-card";
import { RangeSelectorWrapper } from "../../analytics/[alias]/_components/range-selector-wrapper";
import { ReferrerStats } from "../../analytics/[alias]/_components/referrers";
import { UserAgentStats } from "../../analytics/[alias]/_components/user-agent-stats";
import WorldMapHeatmap from "../../analytics/[alias]/_components/world-map-heatmap";

import type { RangeEnum } from "@/server/api/routers/link/link.input";

type QRCodeAnalyticsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function QRCodeAnalyticsPage(props: QRCodeAnalyticsPageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const range = (searchParams?.range ?? "7d") as RangeEnum;

  const qrCode = await api.qrCode.get.query({ id: Number(params.id) });

  if (!qrCode.link) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-neutral-500">No analytics available for this QR code.</p>
      </div>
    );
  }

  const alias = qrCode.link.alias!;
  const domain = qrCode.link.domain ?? "ishortn.ink";

  const {
    totalVisits,
    uniqueVisits,
    topCountry,
    referers,
    topReferrer,
    isProPlan,
    geoRules,
  } = await api.link.linkVisits.query({
    id: alias,
    domain,
    range,
  });

  const aggregatedVisits = aggregateVisits(totalVisits, uniqueVisits);
  const countryData = aggregatedVisits.clicksPerCountry;

  return (
    <div>
      {/* QR Code Header */}
      <div className="flex flex-col items-center justify-between md:flex-row">
        <div className="flex items-center gap-4">
          {qrCode.qrCode && (
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-neutral-100 bg-white p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCode.qrCode}
                alt="QR Code"
                className="h-full w-full object-contain"
              />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold leading-tight tracking-tight text-neutral-900 md:text-2xl">
              {qrCode.title || "Untitled QR Code"}
            </h1>
            <p className="text-[13px] text-neutral-400">
              {qrCode.link.url}
            </p>
            {!isProPlan && (
              <p className="text-[13px] text-neutral-400">
                Viewing limited analytics (last 7 days).{" "}
                <UpgradeText text="Upgrade to Pro" /> for full data.
              </p>
            )}
          </div>
        </div>

        <RangeSelectorWrapper
          initialRange={range}
          isProPlan={isProPlan!}
          domain={domain}
          alias={alias}
          basePath={`/dashboard/qrcodes/${params.id}`}
        />
      </div>

      {/* Quick info cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:mt-8 md:grid-cols-4">
        <QuickInfoCard
          title="Total Scans"
          value={totalVisits.length}
          icon={<IconClick size={16} stroke={1.5} className="text-blue-600" />}
        />
        <QuickInfoCard
          title="Unique Scans"
          value={uniqueVisits.length}
          icon={<IconUsers size={16} stroke={1.5} className="text-blue-600" />}
        />
        <QuickInfoCard
          title="Top Country"
          value={topCountry}
          icon={<IconWorld size={16} stroke={1.5} className="text-blue-600" />}
        />
        <QuickInfoCard
          title="Top Referrer"
          value={topReferrer}
          icon={<IconTrendingUp size={16} stroke={1.5} className="text-blue-600" />}
        />
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
          <h2 className="mb-6 text-base font-semibold tracking-tight text-neutral-900">
            Global QR Code Scans Distribution
          </h2>
          <WorldMapHeatmap data={countryData} />
        </div>
      )}
    </div>
  );
}
