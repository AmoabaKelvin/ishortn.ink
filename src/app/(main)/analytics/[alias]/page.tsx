import { headers } from "next/headers";
import Link from "next/link";

import { aggregateVisits } from "@/lib/core/analytics";
import { removeUrlProtocol } from "@/lib/utils";
import { api } from "@/trpc/server";

import { BarChart } from "../../dashboard/analytics/[alias]/_components/bar-chart";
import {
	CountriesAndCitiesStats,
} from "../../dashboard/analytics/[alias]/countries-and-cities-stats";
import { UserAgentStats } from "../../dashboard/analytics/[alias]/user-agent-stats";

type LinksAnalyticsPageProps = {
  params: {
    alias: string;
  };
};

export default async function LinkAnalyticsPage({ params }: LinksAnalyticsPageProps) {
  const headerList = headers();

  const domain = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "ishortn.ink";

  const obtainedLink = await api.link.getLinkByAlias.query({ alias: params.alias, domain: domain });
  const link = obtainedLink[0];

  if (link?.publicStats === false) {
    return (
      <div className="mt-20 flex flex-col items-center justify-center md:mt-20">
        <h1 className="mb-10 text-3xl">iShortn</h1>
        <p className="text-2xl font-bold">Link not found</p>
        <p className="text-gray-500">
          This link <b className="text-bold">does not have</b> public stats enabled.
        </p>
        <p className="text-center text-gray-500">
          If you know the owner of this link, ask them to enable public stats.
        </p>

        <p className="mt-10 text-blue-500 hover:cursor-pointer">
          <Link href="/" className="flex gap-1">
            Create your own Link
          </Link>
        </p>
      </div>
    );
  }

  const linkVisits = await api.link.linkVisits.query({
    id: params.alias,
    domain: removeUrlProtocol(domain),
  });

  const aggregatedVisits = aggregateVisits(linkVisits);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="cursor-pointer font-semibold leading-tight text-blue-600 hover:underline md:text-3xl">
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
