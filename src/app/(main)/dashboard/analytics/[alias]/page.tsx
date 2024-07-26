import { aggregateVisits } from "@/lib/core/analytics";
import { api } from "@/trpc/server";

import { BarChart } from "./_components/bar-chart";
import { CountriesAndCitiesStats } from "./countries-and-cities-stats";
import { UserAgentStats } from "./user-agent-stats";

type LinksAnalyticsPageProps = {
  params: {
    alias: string;
  };
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function LinkAnalyticsPage({ params, searchParams }: LinksAnalyticsPageProps) {
  const { totalVisits, uniqueVisits } = await api.link.linkVisits.query({
    id: params.alias,
    domain: (searchParams?.domain as string) ?? "ishortn.ink",
  });

  const aggregatedVisits = aggregateVisits(totalVisits, uniqueVisits);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="cursor-pointer font-semibold leading-tight text-blue-600 hover:underline md:text-3xl">
        {searchParams?.domain}/{params.alias}
      </h1>

      <div className="mt-5">
        <BarChart
          clicksPerDate={aggregatedVisits.clicksPerDate}
          uniqueClicksPerDate={aggregatedVisits.uniqueClicksPerDate ?? {}}
          className="h-96"
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-10">
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
