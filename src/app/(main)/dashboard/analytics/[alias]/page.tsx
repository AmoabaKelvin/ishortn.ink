import { aggregateVisits } from "@/lib/core/analytics";
import { api } from "@/trpc/server";

import { BarChart } from "./_components/bar-chart";
import { CountriesAndCitiesStats } from "./countries-and-cities-stats";
import { UserAgentStats } from "./user-agent-stats";

type LinksAnalyticsPageProps = {
  params: {
    alias: string;
  };
};

export default async function LinkAnalyticsPage({ params }: LinksAnalyticsPageProps) {
  const linkVisits = await api.link.linkVisits.query({
    id: params.alias,
  });

  const aggregatedVisits = aggregateVisits(linkVisits);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="cursor-pointer font-semibold leading-tight text-blue-600 hover:underline dark:text-blue-500 md:text-3xl">
        ishortn.ink/{params.alias}
      </h1>

      <div className="mt-5 h-[500px]">
        <BarChart clicksPerDate={aggregatedVisits.clicksPerDate} className="h-96" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-10">
        <CountriesAndCitiesStats
          citiesRecords={aggregatedVisits.clicksPerCity}
          countriesRecords={aggregatedVisits.clicksPerCountry}
          totalClicks={linkVisits.length}
        />

        <UserAgentStats
          clicksPerBrowser={aggregatedVisits.clicksPerBrowser}
          clicksPerDevice={aggregatedVisits.clicksPerDevice}
          clicksPerModel={aggregatedVisits.clicksPerModel}
          clicksPerOS={aggregatedVisits.clicksPerOS}
          totalClicks={linkVisits.length}
        />
      </div>
    </div>
  );
}
