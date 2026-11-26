import {
  IconChevronRight,
  IconClick,
  IconTrendingUp,
  IconUsers,
  IconWorld,
} from "@tabler/icons-react";
import { Link } from "next-view-transitions";
import { notFound } from "next/navigation";
import { z } from "zod";

import { DEFAULT_PLATFORM_DOMAIN } from "@/lib/constants/domains";
import {
  aggregateVisits,
  fillClickSeries,
  mergeArchivedClicks,
  parseCustomRange,
} from "@/lib/core/analytics";
import { analyticsRangeEnum } from "@/server/api/routers/link/link.input";
import { isNotFoundError } from "@/trpc/errors";
import { api } from "@/trpc/server";

import { BarChart } from "../../analytics/[alias]/_components/bar-chart";
import { CountriesAndCitiesStats } from "../../analytics/[alias]/_components/countries-and-cities-stats";
import { GeoRulesStats } from "../../analytics/[alias]/_components/geo-rules-stats";
import { QuickInfoCard } from "../../analytics/[alias]/_components/quick-info-card";
import { RangeSelectorWrapper } from "../../analytics/[alias]/_components/range-selector-wrapper";
import { ReferrerStats } from "../../analytics/[alias]/_components/referrers";
import { UserAgentStats } from "../../analytics/[alias]/_components/user-agent-stats";
import WorldMapHeatmap from "../../analytics/[alias]/_components/world-map-heatmap";
import { LimitedAnalyticsNotice } from "../../analytics/_components/limited-analytics-notice";
import {
  RangePendingContent,
  RangeTransitionProvider,
} from "../../analytics/_components/range-transition";
import { ShareStatsButton } from "../../analytics/_components/share-stats-button";

import type { RouterOutputs } from "@/trpc/shared";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "QR Code Analytics" };

type QRCodeAnalyticsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function QRCodeAnalyticsPage(props: QRCodeAnalyticsPageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const requestedRange = analyticsRangeEnum.catch("7d").parse(searchParams.range);
  const requestedCustom = parseCustomRange(
    z.string().optional().catch(undefined).parse(searchParams.from),
    z.string().optional().catch(undefined).parse(searchParams.to),
  );

  const id = /^\d+$/.test(params.id) ? Number(params.id) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) notFound();

  let qrCode: RouterOutputs["qrCode"]["get"];
  try {
    qrCode = await api.qrCode.get.query({ id });
  } catch (error) {
    // Only a real NOT_FOUND becomes a 404; other failures go to the error boundary.
    if (isNotFoundError(error)) notFound();
    throw error;
  }

  const breadcrumb = (
    <nav className="mb-6 flex min-w-0 items-center gap-1.5 text-[13px]">
      <Link
        href="/dashboard/qrcodes"
        className="shrink-0 text-neutral-400 transition-colors hover:text-neutral-900 dark:text-muted-foreground dark:hover:text-foreground"
      >
        QR Codes
      </Link>
      <IconChevronRight
        size={14}
        stroke={1.5}
        className="shrink-0 text-neutral-300 dark:text-neutral-600"
      />
      <span className="min-w-0 truncate font-medium text-neutral-900 dark:text-foreground">
        {qrCode.title || "Untitled QR Code"}
      </span>
    </nav>
  );

  if (!qrCode.link) {
    return (
      <div>
        {breadcrumb}
        <div className="flex items-center justify-center rounded-lg border border-dashed border-neutral-200 py-20 dark:border-border">
          <p className="text-[13px] text-neutral-500 dark:text-neutral-400">
            No analytics available for this QR code.
          </p>
        </div>
      </div>
    );
  }

  const alias = qrCode.link.alias!;
  const domain = qrCode.link.domain ?? DEFAULT_PLATFORM_DOMAIN;

  // The QR code's link can be gone or outside this workspace; that is a 404, not a crash.
  const visits = await api.link.linkVisits
    .query({ id: alias, domain, range: requestedRange, ...requestedCustom })
    .catch((cause: unknown) => {
      if (isNotFoundError(cause)) notFound();
      throw cause;
    });
  const {
    totalVisits,
    uniqueVisits,
    topCountry,
    referers,
    topReferrer,
    isProPlan,
    geoRules,
    archived,
    hiddenClicks,
    range,
    custom,
    window,
  } = visits;

  const aggregatedVisits = aggregateVisits(totalVisits, uniqueVisits, window.granularity);
  const series = fillClickSeries(mergeArchivedClicks(aggregatedVisits, archived), window);
  const countryData = aggregatedVisits.clicksPerCountry;

  return (
    <RangeTransitionProvider range={range} custom={custom}>
      {breadcrumb}

      {/* QR Code Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {qrCode.qrCode && (
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-neutral-100 bg-white p-1.5 dark:border-border/50">
              {/* eslint-disable-next-line next/no-img-element -- generated QR data: URL */}
              <img src={qrCode.qrCode} alt="QR Code" className="h-full w-full object-contain" />
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="truncate text-xl font-semibold leading-tight tracking-tight text-neutral-900 dark:text-foreground">
              {qrCode.title || "Untitled QR Code"}
            </h1>
            <p
              className="truncate text-[13px] text-neutral-400 dark:text-muted-foreground"
              title={qrCode.link.url ?? undefined}
            >
              {qrCode.link.url}
            </p>
            {!isProPlan && (
              <LimitedAnalyticsNotice hiddenClicks={hiddenClicks} source="qr_analytics" />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <RangeSelectorWrapper isProPlan={isProPlan} />
          <ShareStatsButton linkId={qrCode.link.id} />
        </div>
      </div>

      <RangePendingContent>
        {/* Quick info cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:mt-8 md:grid-cols-4">
          <QuickInfoCard
            title="Total Scans"
            value={totalVisits.length + archived.clicks}
            icon={<IconClick size={16} stroke={1.5} className="text-blue-600 dark:text-blue-400" />}
          />
          <QuickInfoCard
            title="Unique Scans"
            value={uniqueVisits.length + archived.uniqueClicks}
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
              Global QR Code Scans Distribution
            </h2>
            <WorldMapHeatmap data={countryData} />
          </div>
        )}
      </RangePendingContent>
    </RangeTransitionProvider>
  );
}
