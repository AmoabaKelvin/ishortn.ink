import { IconClick, IconUsers } from "@tabler/icons-react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";

import { Wordmark } from "@/app/(landing)/_components/site-primitives";
import { BarChart } from "@/app/(main)/dashboard/analytics/[alias]/_components/bar-chart";
import { CountriesAndCitiesStats } from "@/app/(main)/dashboard/analytics/[alias]/_components/countries-and-cities-stats";
import { QuickInfoCard } from "@/app/(main)/dashboard/analytics/[alias]/_components/quick-info-card";
import { ReferrerStats } from "@/app/(main)/dashboard/analytics/[alias]/_components/referrers";
import { UserAgentStats } from "@/app/(main)/dashboard/analytics/[alias]/_components/user-agent-stats";
import {
  RangePendingContent,
  RangeTransitionProvider,
} from "@/app/(main)/dashboard/analytics/_components/range-transition";
import { consumeRateLimit } from "@/app/api/v1/rate-limit";
import { getSharedStatsReferralUrl } from "@/lib/attribution/referral";
import { isAppHost } from "@/lib/constants/domains";
import { getClientIp } from "@/lib/platform";
import { noIndexMetadata } from "@/lib/seo/indexing";
import { hashIp } from "@/lib/utils/ip-hash";
import { getSharedStats } from "@/server/api/routers/stats-share/stats-share.service";
import { SHARED_STATS_RANGES, sharedStatsRangeLabel } from "@/server/api/routers/stats-share/utils";
import { db } from "@/server/db";

import { SharedRangeSelect } from "./_components/shared-range-select";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Link analytics · iShortn" },
  ...noIndexMetadata,
};

// Page loads per IP, across tokens: generous for a person reading a report, low enough that
// guessing tokens or scraping costs more than it returns.
const PAGE_LOADS_PER_MINUTE = 60;

// User-controlled: anything unexpected falls back to the default range.
const searchParamsSchema = z.object({ range: z.string().optional().catch(undefined) });

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SharedStatsPage(props: Props) {
  const [{ token }, searchParams, headersList] = await Promise.all([
    props.params,
    props.searchParams,
    headers(),
  ]);

  // App host only: on short-link and custom domains /stats/... is not this page.
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "";
  if (!isAppHost(host)) notFound();

  const ip = getClientIp(headersList);
  if (ip) {
    const decision = await consumeRateLimit(`stats:${hashIp(ip)}`, [
      { limit: PAGE_LOADS_PER_MINUTE, windowSeconds: 60 },
    ]);
    if (!decision.allowed) return <RateLimited />;
  }

  const { range: requestedRange } = searchParamsSchema.parse(searchParams);
  const page = await getSharedStats({ db, headers: headersList }, { token, range: requestedRange });
  if (!page) notFound();

  const { stats, range, isPaidPlan } = page;

  return (
    <RangeTransitionProvider range={range}>
      <div className="mx-auto flex min-h-[100dvh] max-w-[1180px] flex-col px-4 pb-8 pt-6 sm:px-6 lg:px-8 lg:pt-10">
        {/* Brand */}
        <Wordmark className="text-[15px] dark:text-foreground [&>svg]:size-4" />

        {/* Header */}
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-all text-xl font-semibold leading-tight tracking-tight text-neutral-900 dark:text-foreground md:text-2xl">
              {page.shortLink}
            </h1>
            {page.title && (
              <p className="mt-1 truncate text-[13px] text-neutral-500 dark:text-neutral-400">
                {page.title}
              </p>
            )}
          </div>
          {isPaidPlan ? (
            <SharedRangeSelect options={SHARED_STATS_RANGES} />
          ) : (
            <p className="shrink-0 text-[13px] text-neutral-500 dark:text-neutral-400">
              {sharedStatsRangeLabel(range)}
            </p>
          )}
        </div>

        <RangePendingContent>
          <div className="mt-6 grid grid-cols-2 gap-3 md:mt-8 md:gap-4">
            <QuickInfoCard
              title="Total Visits"
              value={stats.totalClicks.toLocaleString()}
              icon={<IconClick size={14} stroke={1.5} />}
            />
            <QuickInfoCard
              title="Unique Visits"
              value={stats.uniqueClicks.toLocaleString()}
              icon={<IconUsers size={14} stroke={1.5} />}
            />
          </div>

          <div className="mt-6 md:mt-8">
            <BarChart
              series={stats.series}
              emptyDescription="Clicks on this link will show up here."
            />
          </div>

          {/* Breakdowns: only visits with detail have them, so none to list without one */}
          {stats.detailedClicks > 0 && (
            <div className="mt-6 grid grid-cols-1 gap-4 md:mt-8 md:grid-cols-10">
              <CountriesAndCitiesStats
                countriesRecords={stats.countries}
                citiesRecords={{}}
                continentsRecords={{}}
                totalClicks={stats.detailedClicks}
                proUser={false}
                views={["countries"]}
              />
              <UserAgentStats
                clicksPerDevice={stats.devices}
                clicksPerBrowser={stats.browsers}
                clicksPerOS={stats.os}
                clicksPerModel={{}}
                totalClicks={stats.detailedClicks}
                views={["device", "browser", "os"]}
              />
              <ReferrerStats referers={stats.referrers} totalClicks={stats.detailedClicks} />
            </div>
          )}
        </RangePendingContent>

        {/* Credit */}
        <footer className="mt-auto pt-10 text-center text-[12px] text-neutral-500 dark:text-neutral-400">
          <a
            href={getSharedStatsReferralUrl()}
            className="rounded-md underline-offset-2 hover:text-neutral-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:hover:text-neutral-300"
          >
            Analytics by iShortn &middot; Track your own links free
          </a>
        </footer>
      </div>
    </RangeTransitionProvider>
  );
}

function RateLimited() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-4 text-center">
      <div className="max-w-xs">
        <p className="text-[14px] font-medium text-neutral-900 dark:text-foreground">
          Too many requests
        </p>
        <p className="mt-1 text-[13px] text-neutral-500 dark:text-neutral-400">
          Wait a minute, then reload the page.
        </p>
      </div>
    </main>
  );
}
