import { Crown, Fingerprint, Globe, MousePointerClick } from "lucide-react";

import { aggregateVisits } from "@/lib/core/analytics";
import { api } from "@/trpc/server";

import UpgradeText from "../../qrcodes/upgrade-text";
import { BarChart } from "./_components/bar-chart";
import QuickInfoCard from "./_components/quick-info-card";
import { CountriesAndCitiesStats } from "./countries-and-cities-stats";
import { UserAgentStats } from "./user-agent-stats";

type LinksAnalyticsPageProps = {
  params: {
    alias: string;
  };
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function LinkAnalyticsPage({ params, searchParams }: LinksAnalyticsPageProps) {
  const { totalVisits, uniqueVisits, topCountry, referers, topReferrer, isProPlan } =
    await api.link.linkVisits.query({
      id: params.alias,
      domain: (searchParams?.domain as string) ?? "ishortn.ink",
    });

  const aggregatedVisits = aggregateVisits(totalVisits, uniqueVisits);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col items-center justify-between md:flex-row">
        <h1 className="cursor-pointer font-semibold leading-tight text-blue-600 hover:underline md:text-3xl">
          {searchParams?.domain}/{params.alias}
        </h1>

        {!isProPlan && (
          <div className="mt-2 text-center text-sm text-gray-500">
            You are viewing limited analytics data (last 7 days).{" "}
            <UpgradeText text="Upgrade to Pro" /> for full analytics.
          </div>
        )}
      </div>

      {/* quick info cards */}
      <div className="mt-5 grid grid-cols-1 gap-4 md:mt-10 md:grid-cols-4">
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
        <QuickInfoCard title="Top Country" value={topCountry} icon={<Globe className="size-4" />} />
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

      <div className="mt-5 grid grid-cols-1 gap-4 md:mt-14 md:grid-cols-10">
        <CountriesAndCitiesStats
          citiesRecords={aggregatedVisits.clicksPerCity}
          countriesRecords={aggregatedVisits.clicksPerCountry}
          totalClicks={totalVisits.length}
        />

        <UserAgentStats
          clicksPerBrowser={aggregatedVisits.clicksPerBrowser}
          clicksPerDevice={aggregatedVisits.clicksPerDevice}
          clicksPerModel={aggregatedVisits.clicksPerModel}
          clicksPerOS={aggregatedVisits.clicksPerOS}
          totalClicks={totalVisits.length}
        />
      </div>
    </div>
  );
}
